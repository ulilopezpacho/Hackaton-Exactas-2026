"use server";

import { redirect } from "next/navigation";

import { parseTripDates } from "@/lib/trips/wizard";
import { createClient } from "@/utils/supabase/server";

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
  const { error: promptError } = await supabase
    .from("trips")
    .update({
      route_customization_prompt: customizationPrompt,
      status: "generating",
    })
    .eq("id", payload.tripId)
    .eq("owner_id", user.id);

  if (promptError) {
    redirect(`/app/trips/new/places?tripId=${payload.tripId}&error=prompt`);
  }

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
