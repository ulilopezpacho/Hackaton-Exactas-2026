import { createClient } from "@/utils/supabase/server";
import { solve } from "./solver";
import {
  buildDays,
  buildTravelMatrix,
  extractCoords,
  haversineKm,
  minutesToTime,
  timeToMinutes,
} from "./generate";
import type { PlaceRow } from "./generate";
import type {
  SolverConfig,
  SolverDay,
  SolverInput,
  SolverPlace,
  SolverResult,
} from "./types";

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];

const DEFAULT_CONFIG: SolverConfig = {
  dayStartTime: 9 * 60,
  dayEndTime: 22 * 60,
  mealIntervalMinutes: 240,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = any;

interface WindowRow {
  place_id: string;
  day_of_week: number;
  opens_at: string;
  closes_at: string;
}

export async function replanItinerary(
  tripId: string,
  configOverrides?: Partial<SolverConfig>,
): Promise<SolverResult> {
  console.log(`[replan] Starting solver replan for trip ${tripId}`);
  const supabase: AnySupabase = await createClient();
  const config = { ...DEFAULT_CONFIG, ...configOverrides };

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(
      "id, starts_on, ends_on, owner_id, destination_id, status, current_day_number, current_itinerary_item_id, timezone",
    )
    .eq("id", tripId)
    .single();

  if (tripError || !trip) throw new Error(`Trip not found: ${tripId}`);
  if (trip.status !== "ongoing" || !trip.current_itinerary_item_id) {
    throw new Error("Trip is not ongoing or has no current item");
  }

  console.log(
    `[replan] Trip dates: ${trip.starts_on} to ${trip.ends_on}, current day: ${trip.current_day_number}`,
  );

  const { data: currentItemRow, error: currentItemError } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_id, place_id, item_type, position, starts_at, ends_at")
    .eq("id", trip.current_itinerary_item_id)
    .single();

  if (currentItemError || !currentItemRow) {
    throw new Error("Current itinerary item not found");
  }

  const { data: allItineraries, error: itinError } = await supabase
    .from("itineraries")
    .select("id, day_number, title, status, itinerary_type, generated_from_itinerary_id, created_at")
    .eq("trip_id", tripId)
    .in("status", ["active", "draft"])
    .order("day_number");

  if (itinError) throw new Error(`Failed to fetch itineraries: ${itinError.message}`);

  const itineraryIds = new Set((allItineraries ?? []).map((i: { id: string }) => i.id));
  const ancestorIds = new Set(
    (allItineraries ?? [])
      .filter((i: { generated_from_itinerary_id: string | null }) =>
        i.generated_from_itinerary_id && itineraryIds.has(i.generated_from_itinerary_id))
      .map((i: { generated_from_itinerary_id: string }) => i.generated_from_itinerary_id),
  );

  const leafItineraries = (allItineraries ?? []).filter(
    (i: { id: string; status: string }) => i.status !== "draft" && !ancestorIds.has(i.id),
  );
  const leafItineraryIds = leafItineraries.map((i: { id: string }) => i.id);

  const { data: allItems, error: itemsError } = await supabase
    .from("itinerary_items")
    .select("id, itinerary_id, place_id, item_type, title, starts_at, ends_at, position, locked, score")
    .in("itinerary_id", leafItineraryIds)
    .order("position");

  if (itemsError) throw new Error(`Failed to fetch items: ${itemsError.message}`);

  const itineraryByDay = new Map<number, { id: string; day_number: number; title: string }>();
  for (const itin of leafItineraries) {
    itineraryByDay.set(itin.day_number, itin);
  }

  const currentDayItinerary = itineraryByDay.get(trip.current_day_number);
  if (!currentDayItinerary) {
    throw new Error(`No itinerary found for current day ${trip.current_day_number}`);
  }

  const currentDayItems = (allItems ?? []).filter(
    (item: { itinerary_id: string }) => item.itinerary_id === currentDayItinerary.id,
  );

  const visitedItems = currentDayItems.filter(
    (item: { position: number }) => item.position <= currentItemRow.position,
  );

  const remainingPlaceIds: string[] = [];

  const pendingCurrentDay = currentDayItems.filter(
    (item: { position: number; item_type: string }) =>
      item.position > currentItemRow.position && item.item_type === "place",
  );
  for (const item of pendingCurrentDay) {
    if (item.place_id) remainingPlaceIds.push(item.place_id);
  }

  const totalDays = buildDays(trip.starts_on, trip.ends_on).length;
  for (let dayNum = trip.current_day_number + 1; dayNum <= totalDays; dayNum++) {
    const dayItin = itineraryByDay.get(dayNum);
    if (!dayItin) continue;
    const dayItems = (allItems ?? []).filter(
      (item: { itinerary_id: string; item_type: string }) =>
        item.itinerary_id === dayItin.id && item.item_type === "place",
    );
    for (const item of dayItems) {
      if (item.place_id) remainingPlaceIds.push(item.place_id);
    }
  }

  const uniquePlaceIds = [...new Set(remainingPlaceIds)];
  console.log(`[replan] Found ${visitedItems.length} visited items, ${uniquePlaceIds.length} remaining places`);

  if (uniquePlaceIds.length === 0) {
    console.log("[replan] No remaining places to replan");
    return { days: [], score: 0, unplacedPlaces: [] };
  }

  const allPlaceIds = [...uniquePlaceIds];
  if (trip.destination_id) {
    const { data: mealRows } = await supabase
      .from("places")
      .select("id")
      .eq("destination_id", trip.destination_id)
      .eq("status", "active");

    const mealIds = (mealRows ?? [])
      .map((p: { id: string }) => p.id)
      .filter((id: string) => !allPlaceIds.includes(id));
    allPlaceIds.push(...mealIds);
  }

  const { data: placesRaw, error: placesError } = await supabase
    .from("places")
    .select(
      "id, name, description, category, default_duration_minutes, rating, user_ratings_total, quality_score, popularity, location",
    )
    .in("id", allPlaceIds)
    .eq("status", "active");

  if (placesError) throw new Error(`Failed to fetch places: ${placesError.message}`);

  const placeRows = (placesRaw ?? []) as PlaceRow[];
  const placeRowIds = placeRows.map((p) => p.id);

  const { data: windowsRaw, error: windowsError } = await supabase
    .from("place_opening_windows")
    .select("place_id, day_of_week, opens_at, closes_at")
    .in("place_id", placeRowIds);

  if (windowsError) throw new Error(`Failed to fetch opening windows: ${windowsError.message}`);

  const windowRows = (windowsRaw ?? []) as WindowRow[];
  const windowsByPlace = new Map<string, WindowRow[]>();
  for (const w of windowRows) {
    const list = windowsByPlace.get(w.place_id) ?? [];
    list.push(w);
    windowsByPlace.set(w.place_id, list);
  }

  const existingScores = new Map<string, number>();
  for (const item of allItems ?? []) {
    if (item.place_id && item.score != null) {
      existingScores.set(item.place_id, item.score);
    }
  }

  const places: SolverPlace[] = [];
  const mealPlaces: SolverPlace[] = [];

  for (const raw of placeRows) {
    const sp: SolverPlace = {
      id: raw.id,
      name: raw.name,
      durationMinutes: raw.default_duration_minutes ?? 60,
      openingWindows: (windowsByPlace.get(raw.id) ?? []).map((w) => ({
        dayOfWeek: w.day_of_week,
        opensAt: timeToMinutes(w.opens_at),
        closesAt: timeToMinutes(w.closes_at),
      })),
      score: existingScores.get(raw.id),
    };

    const isMeal =
      raw.category != null &&
      MEAL_CATEGORIES.some((mc) =>
        raw.category!.toLowerCase().includes(mc.toLowerCase()),
      );

    if (isMeal && !uniquePlaceIds.includes(raw.id)) {
      mealPlaces.push(sp);
    } else if (uniquePlaceIds.includes(raw.id)) {
      places.push(sp);
    }
  }

  console.log(`[replan] ${places.length} activity places, ${mealPlaces.length} meal places`);

  const currentItemEnd = new Date(currentItemRow.ends_at);
  const currentDayStartMinutes =
    currentItemEnd.getHours() * 60 + currentItemEnd.getMinutes();

  const allTripDays = buildDays(trip.starts_on, trip.ends_on);
  const solverDays: SolverDay[] = [];

  const currentDayData = allTripDays[trip.current_day_number - 1];
  if (currentDayData) {
    solverDays.push({
      date: currentDayData.date,
      dayOfWeek: currentDayData.dayOfWeek,
      startTime: currentDayStartMinutes,
    });
  }

  for (let dayNum = trip.current_day_number + 1; dayNum <= totalDays; dayNum++) {
    const dayData = allTripDays[dayNum - 1];
    if (dayData) {
      solverDays.push({
        date: dayData.date,
        dayOfWeek: dayData.dayOfWeek,
      });
    }
  }

  console.log(
    `[replan] Solver input: ${places.length} places, ${solverDays.length} days (first day starts at ${currentDayStartMinutes} min)`,
  );

  const travelMatrix = buildTravelMatrix(placeRows);

  const input: SolverInput = {
    places,
    mealPlaces,
    days: solverDays,
    travelMatrix,
    config,
  };

  const result = solve(input);
  console.log(
    `[replan] Solver finished. Days: ${result.days.filter((d) => d.items.length > 0).length}, Score: ${result.score}`,
  );

  await writeReplanToSupabase(
    supabase,
    tripId,
    trip,
    result,
    solverDays,
    visitedItems,
    currentDayItinerary,
    leafItineraries,
    existingScores,
  );

  return result;
}

async function writeReplanToSupabase(
  supabase: AnySupabase,
  tripId: string,
  trip: { current_day_number: number; current_itinerary_item_id: string },
  result: SolverResult,
  solverDays: SolverDay[],
  visitedItems: Array<{
    id: string;
    place_id: string | null;
    item_type: string;
    title: string;
    starts_at: string;
    ends_at: string;
    position: number;
    locked: boolean;
    score: number | null;
  }>,
  currentDayItinerary: { id: string; day_number: number; title: string },
  leafItineraries: Array<{ id: string; day_number: number; title: string }>,
  scoresByPlaceId: Map<string, number>,
) {
  let newCurrentItemId: string | null = null;

  await supabase
    .from("itineraries")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", currentDayItinerary.id);

  const { data: newCurrentDayItin, error: newItinError } = await supabase
    .from("itineraries")
    .insert({
      trip_id: tripId,
      day_number: currentDayItinerary.day_number,
      status: "active",
      itinerary_type: "smart_generated",
      generated_from_itinerary_id: currentDayItinerary.id,
      title: currentDayItinerary.title,
    })
    .select("id")
    .single();

  if (newItinError || !newCurrentDayItin) {
    throw new Error(`Failed to create new itinerary for current day: ${newItinError?.message}`);
  }

  const visitedItemRows = visitedItems
    .sort((a, b) => a.position - b.position)
    .map((item) => ({
      itinerary_id: newCurrentDayItin.id,
      place_id: item.place_id,
      item_type: item.item_type,
      title: item.title,
      starts_at: item.starts_at,
      ends_at: item.ends_at,
      position: item.position,
      locked: item.locked,
      score: item.score,
    }));

  if (visitedItemRows.length > 0) {
    const { data: insertedVisited, error: visitedError } = await supabase
      .from("itinerary_items")
      .insert(visitedItemRows)
      .select("id, position");

    if (visitedError) throw new Error(`Failed to copy visited items: ${visitedError.message}`);

    const currentItemPosition = visitedItems.find(
      (v) => v.id === trip.current_itinerary_item_id,
    )?.position;

    if (currentItemPosition != null) {
      const remapped = (insertedVisited ?? []).find(
        (item: { position: number }) => item.position === currentItemPosition,
      );
      if (remapped) {
        newCurrentItemId = remapped.id;
      }
    }
  }

  const currentDaySolverResult = result.days.find((d) => d.dayIndex === 0);
  if (currentDaySolverResult && currentDaySolverResult.items.length > 0) {
    const nextPosition = visitedItems.length > 0
      ? Math.max(...visitedItems.map((v) => v.position)) + 1
      : 0;

    const currentDayDate = solverDays[0].date;
    const newItemRows = currentDaySolverResult.items.map((item, idx) => ({
      itinerary_id: newCurrentDayItin.id,
      place_id: item.placeId,
      item_type: item.type,
      title: item.title,
      starts_at: `${currentDayDate}T${minutesToTime(item.startMinute)}:00`,
      ends_at: `${currentDayDate}T${minutesToTime(item.endMinute)}:00`,
      position: nextPosition + idx,
      score: item.placeId ? scoresByPlaceId.get(item.placeId) ?? null : null,
    }));

    const { error: newItemsError } = await supabase
      .from("itinerary_items")
      .insert(newItemRows);

    if (newItemsError) throw new Error(`Failed to insert solver items for current day: ${newItemsError.message}`);
  }

  for (let solverDayIdx = 1; solverDayIdx < solverDays.length; solverDayIdx++) {
    const dayNum = trip.current_day_number + solverDayIdx;
    const existingItin = leafItineraries.find(
      (i: { day_number: number }) => i.day_number === dayNum,
    );

    if (existingItin) {
      await supabase
        .from("itineraries")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", existingItin.id);
    }

    const { data: newDayItin, error: newDayError } = await supabase
      .from("itineraries")
      .insert({
        trip_id: tripId,
        day_number: dayNum,
        status: "active",
        itinerary_type: "smart_generated",
        generated_from_itinerary_id: existingItin?.id ?? null,
        title: `Día ${dayNum}`,
      })
      .select("id")
      .single();

    if (newDayError || !newDayItin) {
      throw new Error(`Failed to create itinerary for day ${dayNum}: ${newDayError?.message}`);
    }

    const daySolverResult = result.days.find((d) => d.dayIndex === solverDayIdx);
    if (daySolverResult && daySolverResult.items.length > 0) {
      const dayDate = solverDays[solverDayIdx].date;
      const itemRows = daySolverResult.items.map((item, position) => ({
        itinerary_id: newDayItin.id,
        place_id: item.placeId,
        item_type: item.type,
        title: item.title,
        starts_at: `${dayDate}T${minutesToTime(item.startMinute)}:00`,
        ends_at: `${dayDate}T${minutesToTime(item.endMinute)}:00`,
        position,
        score: item.placeId ? scoresByPlaceId.get(item.placeId) ?? null : null,
      }));

      const { error: dayItemsError } = await supabase
        .from("itinerary_items")
        .insert(itemRows);

      if (dayItemsError) {
        throw new Error(`Failed to insert items for day ${dayNum}: ${dayItemsError.message}`);
      }
    }
  }

  if (newCurrentItemId) {
    await supabase
      .from("trips")
      .update({
        current_itinerary_item_id: newCurrentItemId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);
  }

  console.log(`[replan] Wrote replan to Supabase. New current item: ${newCurrentItemId}`);
}
