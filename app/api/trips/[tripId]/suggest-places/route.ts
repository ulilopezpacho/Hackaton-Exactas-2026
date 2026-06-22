import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveDestination } from "@/lib/places/google";
import { generatePlaces } from "@/lib/places/generate";
import { scorePlaces, type PlaceForScoring } from "@/lib/places/score";
import { mergeSearchInterests } from "@/lib/places/preference-interests";

/**
 * Suggests scored places for the trip-places wizard form. Uses the (still
 * unsaved) trip notes + the user's saved preferences to curate places via the
 * AI provider, then attaches a deterministic relevance score to each one.
 *
 * Unlike `/place-catalog`, this endpoint does NOT persist the curated places —
 * the client adds them to the editable list and they get upserted on form
 * submit like any manual place. It does set `trip.destination_id` so the
 * itinerary generator/enrichment have destination context later.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId } = await params;

  let body: { notes?: string } = {};
  try {
    body = (await request.json()) as { notes?: string };
  } catch {
    // Empty body is fine — fall back to saved preferences only.
  }
  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : undefined;

  // 1. Fetch trip data
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("title, starts_on, ends_on")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  // 2. Fetch user preferences
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("interests, pace, budget, travel_style_prompt")
    .eq("user_id", user.id)
    .maybeSingle();

  // Without trip notes, fall back to global interests as search guidance.
  const fallbackInterests = notes
    ? []
    : mergeSearchInterests([], (prefs?.interests as string[]) || []);

  // 3. Resolve and upsert destination, link it to the trip
  const destinationCandidate = await resolveDestination(trip.title);
  if (!destinationCandidate) {
    return Response.json(
      { error: "Could not resolve destination" },
      { status: 400 },
    );
  }

  const { data: destination, error: destError } = await supabase
    .from("destinations")
    .upsert(
      {
        owner_id: null, // Shared catalog row
        source: "google",
        external_id: destinationCandidate.externalId,
        name: destinationCandidate.name,
        country: destinationCandidate.country,
        admin_area: destinationCandidate.adminArea,
        description: destinationCandidate.description,
        location: `SRID=4326;POINT(${destinationCandidate.lng} ${destinationCandidate.lat})`,
        status: "active",
      },
      { onConflict: "external_id" },
    )
    .select("id, name")
    .single();

  if (destError || !destination) {
    return Response.json(
      { error: "Failed to save destination", details: destError },
      { status: 500 },
    );
  }

  await supabase
    .from("trips")
    .update({ destination_id: destination.id })
    .eq("id", tripId);

  // 4. Generate curated places from notes + preferences
  const curated = await generatePlaces({
    destination: destination.name,
    title: trip.title,
    startsOn: trip.starts_on,
    endsOn: trip.ends_on,
    routeCustomizationPrompt: notes,
    interests: fallbackInterests.length > 0 ? fallbackInterests : undefined,
    pace: (prefs?.pace as string) || undefined,
    budget: (prefs?.budget as string) || undefined,
    travelStylePrompt: (prefs?.travel_style_prompt as string) || undefined,
    lat: destinationCandidate.lat,
    lng: destinationCandidate.lng,
  });

  // 5. Score curated places (deterministic quality/popularity ranking). We use
  // externalId as the scoring id so we can reassociate the score afterwards.
  const placesForScoring: PlaceForScoring[] = curated.map((p) => ({
    id: p.externalId,
    name: p.name,
    description: p.description,
    category: p.category,
    rating: p.rating ?? null,
    userRatingsTotal: p.userRatingsTotal ?? null,
    qualityScore: p.qualityScore ?? null,
    popularity: p.popularity ?? null,
  }));

  const scored = await scorePlaces({
    places: placesForScoring,
    userPreferences: {
      interests: fallbackInterests,
      pace: (prefs?.pace as string) ?? null,
      budget: (prefs?.budget as string) ?? null,
      travelStylePrompt: (prefs?.travel_style_prompt as string) ?? null,
    },
    tripCustomizationPrompt: notes,
  });

  const scoreByExternalId = new Map(scored.map((s) => [s.id, s.score]));
  const curatedByExternalId = new Map(curated.map((p) => [p.externalId, p]));

  // 6. Build response sorted by score desc, in the shape the form consumes.
  const places = scored
    .map((s) => {
      const place = curatedByExternalId.get(s.id);
      if (!place) return null;
      return {
        name: place.name,
        address: place.address ?? null,
        latitude: place.lat,
        longitude: place.lng,
        category: place.category ?? null,
        placeId: place.externalId,
        durationMinutes: place.defaultDurationMinutes ?? 90,
        score: scoreByExternalId.get(s.id) ?? s.score,
      };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return Response.json({ destination: destination.name, places });
}
