import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { solve } from "@/lib/itinerary/solver";
import type { SolverInput, SolverPlace, TravelMatrix } from "@/lib/itinerary/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any;

export async function POST() {
  const supabase: S = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // 1. Create test trip
  const { data: trip, error: tripErr } = await supabase
    .from("trips")
    .insert({
      owner_id: user.id,
      title: "Test Madrid Trip",
      starts_on: "2026-06-15",
      ends_on: "2026-06-17",
    })
    .select("id")
    .single();
  if (tripErr) return NextResponse.json({ error: tripErr.message }, { status: 500 });

  // 2. Create test places
  const placeDefs = [
    { name: "Palacio Real", category: "historia", duration: 120 },
    { name: "Museo del Prado", category: "arte", duration: 180 },
    { name: "Plaza Mayor", category: "clásico", duration: 60 },
    { name: "Parque del Retiro", category: "aire libre", duration: 90 },
    { name: "Templo de Debod", category: "historia", duration: 45 },
    { name: "Mercado de San Miguel", category: "gastro", duration: 60 },
    { name: "Sobrino de Botín", category: "restaurante", duration: 75 },
  ];

  const { data: dbPlaces, error: placeErr } = await supabase
    .from("places")
    .insert(
      placeDefs.map((p) => ({
        owner_id: user.id,
        name: p.name,
        category: p.category,
        default_duration_minutes: p.duration,
        source: "manual",
        status: "active",
      }))
    )
    .select("id, name, category, default_duration_minutes");
  if (placeErr) return NextResponse.json({ error: placeErr.message }, { status: 500 });

  // 3. Create opening windows (Mon=1, Tue=2, Wed=3)
  const windowRows: { place_id: string; day_of_week: number; opens_at: string; closes_at: string }[] = [];
  for (const p of dbPlaces) {
    if (p.name === "Templo de Debod") {
      windowRows.push({ place_id: p.id, day_of_week: 2, opens_at: "10:00", closes_at: "19:00" });
    } else if (p.name === "Sobrino de Botín") {
      for (const d of [1, 2, 3]) {
        windowRows.push({ place_id: p.id, day_of_week: d, opens_at: "13:00", closes_at: "23:00" });
      }
    } else if (p.name === "Mercado de San Miguel") {
      for (const d of [1, 2, 3]) {
        windowRows.push({ place_id: p.id, day_of_week: d, opens_at: "10:00", closes_at: "24:00" });
      }
    } else if (["Palacio Real", "Museo del Prado"].includes(p.name)) {
      for (const d of [1, 2, 3]) {
        windowRows.push({ place_id: p.id, day_of_week: d, opens_at: "10:00", closes_at: "18:00" });
      }
    }
    // Plaza Mayor & Retiro have no windows = always open
  }

  if (windowRows.length > 0) {
    const { error: winErr } = await supabase.from("place_opening_windows").insert(windowRows);
    if (winErr) return NextResponse.json({ error: winErr.message }, { status: 500 });
  }

  // 4. Build solver input
  const mealCategories = ["restaurante", "café", "cafetería", "bar", "gastro"];

  const places: SolverPlace[] = [];
  const mealPlaces: SolverPlace[] = [];

  const windowsByPlace = new Map<string, typeof windowRows>();
  for (const w of windowRows) {
    const list = windowsByPlace.get(w.place_id) ?? [];
    list.push(w);
    windowsByPlace.set(w.place_id, list);
  }

  for (const raw of dbPlaces) {
    const sp: SolverPlace = {
      id: raw.id,
      name: raw.name,
      durationMinutes: raw.default_duration_minutes ?? 60,
      openingWindows: (windowsByPlace.get(raw.id) ?? []).map((w) => ({
        dayOfWeek: w.day_of_week,
        opensAt: timeToMinutes(w.opens_at),
        closesAt: timeToMinutes(w.closes_at),
      })),
    };

    const isMeal =
      raw.category != null &&
      mealCategories.some((mc: string) => raw.category.toLowerCase().includes(mc));

    if (isMeal) {
      mealPlaces.push(sp);
    } else {
      places.push(sp);
    }
  }

  const travelMatrix: TravelMatrix = {};
  const allIds = [...places, ...mealPlaces].map((p) => p.id);
  for (const a of allIds) {
    travelMatrix[a] = {};
    for (const b of allIds) {
      travelMatrix[a][b] = a === b ? 0 : 12;
    }
  }

  const input: SolverInput = {
    places,
    mealPlaces,
    days: [
      { date: "2026-06-15", dayOfWeek: 1 },
      { date: "2026-06-16", dayOfWeek: 2 },
      { date: "2026-06-17", dayOfWeek: 3 },
    ],
    travelMatrix,
    config: { dayStartTime: 9 * 60, dayEndTime: 22 * 60, mealIntervalMinutes: 240 },
  };

  // 5. Run solver
  const result = solve(input);

  // 6. Write itineraries + items to DB
  const createdItineraries = [];
  for (const daySchedule of result.days) {
    const { data: itinerary, error: itinErr } = await supabase
      .from("itineraries")
      .insert({
        trip_id: trip.id,
        day_number: daySchedule.dayIndex + 1,
        status: "draft",
      })
      .select("id, day_number")
      .single();

    if (itinErr) return NextResponse.json({ error: itinErr.message }, { status: 500 });

    const dayDate = input.days[daySchedule.dayIndex].date;
    const itemRows = daySchedule.items.map((item, position) => ({
      itinerary_id: itinerary.id,
      place_id: item.placeId,
      item_type: item.type,
      title: item.title,
      starts_at: `${dayDate}T${minutesToTime(item.startMinute)}:00`,
      ends_at: `${dayDate}T${minutesToTime(item.endMinute)}:00`,
      position,
    }));

    let createdItems: unknown[] = [];
    if (itemRows.length > 0) {
      const { data, error: itemsErr } = await supabase
        .from("itinerary_items")
        .insert(itemRows)
        .select("id, item_type, title, starts_at, ends_at, position, place_id");
      if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 });
      createdItems = data ?? [];
    }

    createdItineraries.push({ ...itinerary, items: createdItems });
  }

  return NextResponse.json({
    tripId: trip.id,
    solverScore: result.score,
    unplacedPlaces: result.unplacedPlaces,
    itineraries: createdItineraries,
  });
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
