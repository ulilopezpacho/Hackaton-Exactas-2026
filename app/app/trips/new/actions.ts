"use server";

import { redirect } from "next/navigation";

import { parseTripDates } from "@/lib/trips/wizard";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type WizardPlacePayload = {
  address?: string | null;
  category?: string | null;
  durationMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
  name: string;
  placeId?: string;
};

type WizardDraftPayload = {
  endsOn: string;
  interests: string[];
  notes: string;
  places: WizardPlacePayload[];
  startsOn: string;
  title: string;
  tripId: string;
};

type PlaceInsert = Database["public"]["Tables"]["places"]["Insert"];
type ItineraryItemInsert = Database["public"]["Tables"]["itinerary_items"]["Insert"];

export async function createTripDraft(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const startsOn = String(formData.get("startsOn") ?? "");
  const endsOn = String(formData.get("endsOn") ?? "");

  if (!title) {
    redirect("/app/trips/new/destination?error=destination");
  }

  let range;
  try {
    range = parseTripDates(startsOn, endsOn);
  } catch {
    redirect("/app/trips/new/destination?error=dates");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: trip, error } = await supabase
    .from("trips")
    .insert({
      ends_on: range.endsOn,
      owner_id: user.id,
      starts_on: range.startsOn,
      title,
    })
    .select("id")
    .single();

  if (error) {
    redirect("/app/trips/new/destination?error=save");
  }

  redirect(`/app/trips/new/places?tripId=${trip.id}`);
}

export async function saveTripGenerationContext(formData: FormData) {
  const payloadValue = String(formData.get("payload") ?? "");
  const payload = parseWizardDraftPayload(payloadValue);
  const range = parseTripDates(payload.startsOn, payload.endsOn);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: trip } = await supabase
    .from("trips")
    .select("id")
    .eq("id", payload.tripId)
    .eq("owner_id", user.id)
    .single();

  if (!trip) {
    redirect("/app/trips/new/destination?error=missing-trip");
  }

  const customizationPrompt = buildCustomizationPrompt(payload);
  await supabase
    .from("trips")
    .update({ 
      route_customization_prompt: customizationPrompt,
      status: "generating"
    })
    .eq("id", payload.tripId)
    .eq("owner_id", user.id);

  // We still need to upsert places and create a tentative itinerary 
  // so the Wizard can fetch the place IDs and run the solver.
  const places = await upsertPlaces(payload.places, user.id);

  const { data: existingItineraries } = await supabase
    .from("itineraries")
    .select("id")
    .eq("trip_id", payload.tripId)
    .eq("itinerary_type", "wizard_tentative");

  const existingIds = existingItineraries?.map(({ id }) => id) ?? [];

  if (existingIds.length > 0) {
    await supabase.from("itinerary_items").delete().in("itinerary_id", existingIds);
    await supabase.from("itineraries").delete().in("id", existingIds);
  }

  const dayInserts = Array.from({ length: range.dayCount }, (_, index) => ({
    day_number: index + 1,
    itinerary_type: "wizard_tentative",
    status: "draft" as const,
    title: `Día ${index + 1}`,
    trip_id: payload.tripId,
  }));
  
  const { data: itineraries, error: itineraryError } = await supabase
    .from("itineraries")
    .insert(dayInserts)
    .select("id, day_number");

  if (itineraryError || !itineraries) {
    redirect(`/app/trips/new/places?tripId=${payload.tripId}&error=itinerary`);
  }

  // For simplicity and to satisfy the Wizard's need for place IDs, 
  // we just put all places in day 1 of the tentative itinerary.
  const itemInserts: ItineraryItemInsert[] = payload.places.map((place, index) => ({
    description: null,
    ends_at: `${payload.startsOn}T10:30:00Z`,
    itinerary_id: itineraries[0].id,
    item_type: "place",
    locked: false,
    place_id: places[index]?.id ?? null,
    position: index,
    starts_at: `${payload.startsOn}T09:00:00Z`,
    title: place.name,
  }));

  if (itemInserts.length > 0) {
    const { error: itemsError } = await supabase
      .from("itinerary_items")
      .insert(itemInserts);

    if (itemsError) {
      redirect(`/app/trips/new/places?tripId=${payload.tripId}&error=items`);
    }
  }

  redirect(`/app/trips/new/generating?tripId=${payload.tripId}`);
}

function parseWizardDraftPayload(value: string): WizardDraftPayload {
  const parsed = JSON.parse(value) as Partial<WizardDraftPayload>;

  if (
    typeof parsed.tripId !== "string" ||
    typeof parsed.title !== "string" ||
    typeof parsed.startsOn !== "string" ||
    typeof parsed.endsOn !== "string" ||
    !Array.isArray(parsed.places) ||
    !Array.isArray(parsed.interests)
  ) {
    throw new Error("Payload de viaje inválido.");
  }

  return {
    endsOn: parsed.endsOn,
    interests: parsed.interests.filter(
      (interest): interest is string => typeof interest === "string",
    ),
    notes: typeof parsed.notes === "string" ? parsed.notes.trim().slice(0, 600) : "",
    places: parsed.places
      .map((place): WizardPlacePayload | null => {
        if (
          typeof place !== "object" ||
          place === null ||
          !("name" in place) ||
          typeof place.name !== "string"
        ) {
          return null;
        }

        return {
          address:
            "address" in place && typeof place.address === "string"
              ? place.address
              : null,
          category:
            "category" in place && typeof place.category === "string"
              ? place.category
              : null,
          durationMinutes:
            "durationMinutes" in place &&
            typeof place.durationMinutes === "number"
              ? place.durationMinutes
              : 90,
          latitude:
            "latitude" in place && typeof place.latitude === "number"
              ? place.latitude
              : null,
          longitude:
            "longitude" in place && typeof place.longitude === "number"
              ? place.longitude
              : null,
          name: place.name.trim(),
          placeId:
            "placeId" in place && typeof place.placeId === "string"
              ? place.placeId
              : undefined,
        };
      })
      .filter((place): place is WizardPlacePayload => Boolean(place?.name)),
    startsOn: parsed.startsOn,
    title: parsed.title,
    tripId: parsed.tripId,
  };
}

async function upsertPlaces(places: WizardPlacePayload[], userId: string) {
  const supabase = await createClient();
  const persisted = [];

  for (const place of places) {
    const existing =
      place.placeId &&
      (await supabase
        .from("places")
        .select("id")
        .eq("owner_id", userId)
        .eq("source", "google")
        .eq("external_id", place.placeId)
        .maybeSingle());

    if (existing && existing.data) {
      persisted.push(existing.data);
      continue;
    }

    const insert: PlaceInsert = {
      address: place.address ?? null,
      category: place.category ?? null,
      default_duration_minutes: place.durationMinutes,
      external_id: place.placeId ?? null,
      location:
        place.latitude !== null &&
        place.latitude !== undefined &&
        place.longitude !== null &&
        place.longitude !== undefined
          ? `SRID=4326;POINT(${place.longitude} ${place.latitude})`
          : null,
      name: place.name,
      owner_id: userId,
      source: place.placeId ? "google" : "manual",
      status: "active",
    };
    const { data, error } = await supabase
      .from("places")
      .insert(insert)
      .select("id")
      .single();

    if (error) {
      throw error;
    }

    persisted.push(data);
  }

  return persisted;
}

function buildCustomizationPrompt(payload: WizardDraftPayload) {
  const notes = payload.notes || `El usuario no agregó notas libres.`;
  const priorityText = payload.places
    .map((place, index) => {
      const details = [place.address, place.category]
        .filter(Boolean)
        .join(" · ");
      return details
        ? `${index + 1}. ${place.name} (${details})`
        : `${index + 1}. ${place.name}`;
    })
    .join("\n");

  return `${notes}\n\nLugares priorizados por el usuario para que el LLM los considere al armar el plan final:\n${priorityText}`;
}
