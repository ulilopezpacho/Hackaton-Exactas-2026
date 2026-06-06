"use server";

import { redirect } from "next/navigation";

import type { Database } from "@/lib/supabase/database.types";
import {
  buildSequentialItineraryItems,
  parseTripDates,
  type WizardPlaceDraft,
} from "@/lib/trips/wizard";
import { createClient } from "@/utils/supabase/server";

type WizardPlacePayload = WizardPlaceDraft & {
  address?: string | null;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
type ItineraryItemInsert =
  Database["public"]["Tables"]["itinerary_items"]["Insert"];

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

export async function saveTentativeItinerary(formData: FormData) {
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

  await supabase
    .from("trips")
    .update({ route_customization_prompt: payload.notes || null })
    .eq("id", payload.tripId)
    .eq("owner_id", user.id);

  const places = await upsertPlaces(payload.places, user.id);
  const generationPrompt = buildGenerationPrompt(payload);

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
    generation_prompt: generationPrompt,
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

  const itineraryIdByDay = new Map(
    itineraries.map(({ day_number, id }) => [day_number, id]),
  );
  const items = buildSequentialItineraryItems({
    ...range,
    places: payload.places.map((place) => ({
      durationMinutes: place.durationMinutes,
      name: place.name,
      placeId: place.placeId,
    })),
  });
  const itemInserts: ItineraryItemInsert[] = items.map((item) => ({
    description: null,
    ends_at: item.endsAt,
    itinerary_id: itineraryIdByDay.get(item.dayNumber) ?? itineraries[0].id,
    item_type: "place",
    locked: false,
    place_id: places[item.position]?.id ?? null,
    position: item.position,
    starts_at: item.startsAt,
    title: item.title,
  }));

  if (itemInserts.length > 0) {
    const { error: itemsError } = await supabase
      .from("itinerary_items")
      .insert(itemInserts);

    if (itemsError) {
      redirect(`/app/trips/new/places?tripId=${payload.tripId}&error=items`);
    }
  }

  redirect(`/app/trips/${payload.tripId}/itinerary`);
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

function buildGenerationPrompt(payload: WizardDraftPayload) {
  const priorityText = payload.places
    .map((place, index) => `${index + 1}. ${place.name}`)
    .join("\n");
  const customizationPrompt =
    payload.notes || `Armá un recorrido para ${payload.title}.`;

  return `${customizationPrompt}\n\nLa lista de prioridades es:\n${priorityText}`;
}
