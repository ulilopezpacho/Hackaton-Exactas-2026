"use server";

import { redirect } from "next/navigation";

import { parseTripDates } from "@/lib/trips/wizard";
import { createClient } from "@/utils/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  DEFAULT_PLACE_PRIORITY,
  PLACE_PRIORITY_OPTIONS,
  isPlacePriority,
  type PlacePriority,
} from "@/lib/places/priority";

type WizardPlacePayload = {
  address?: string | null;
  category?: string | null;
  durationMinutes: number;
  latitude?: number | null;
  longitude?: number | null;
  name: string;
  placeId?: string;
  priority: PlacePriority;
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
  parseTripDates(payload.startsOn, payload.endsOn);

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

  const places = await upsertPlaces(payload.places, user.id);
  const params = new URLSearchParams({ tripId: payload.tripId });

  // `upsertPlaces` returns ids 1:1 and in the same order as `payload.places`, so
  // we can append the matching priority alongside each placeId (aligned by index).
  places.forEach((place, index) => {
    params.append("placeId", place.id);
    params.append("priority", payload.places[index]?.priority ?? DEFAULT_PLACE_PRIORITY);
  });

  redirect(`/app/trips/new/generating?${params}`);
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
          priority:
            "priority" in place && isPlacePriority(place.priority)
              ? place.priority
              : DEFAULT_PLACE_PRIORITY,
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
      // The place is already in the user's catalog: keep its row but refresh the
      // visit duration to whatever the user just chose, so the solver uses it.
      await supabase
        .from("places")
        .update({ default_duration_minutes: place.durationMinutes })
        .eq("id", existing.data.id);
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
  const notes = payload.notes.trim();
  const priorityLabels = Object.fromEntries(
    PLACE_PRIORITY_OPTIONS.map((option) => [option.value, option.label]),
  ) as Record<PlacePriority, string>;
  const priorityText = payload.places
    .map((place) => {
      const details = [place.address, place.category]
        .filter(Boolean)
        .join(" · ");
      const label = priorityLabels[place.priority];
      return details
        ? `- ${place.name} (${details}) — ${label}`
        : `- ${place.name} — ${label}`;
    })
    .join("\n");

  if (!priorityText) {
    return notes || null;
  }

  const prioritySection =
    `Lugares opcionales priorizados por el usuario para que el LLM los considere al armar el plan final:\n${priorityText}`;

  return notes ? `${notes}\n\n${prioritySection}` : prioritySection;
}
