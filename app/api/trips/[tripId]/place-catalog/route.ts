import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { resolveDestination } from "@/lib/places/google";
import { generatePlaces } from "@/lib/places/generate";

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

  // 1. Fetch trip data
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("title, starts_on, ends_on")
    .eq("id", tripId)
    .single();

  if (tripError || !trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  // 2. Determine destination text (fallback to title)
  const { data: itineraryData } = await supabase
    .from("itineraries")
    .select("id")
    .eq("trip_id", tripId)
    .maybeSingle();

  let destinationText = trip.title;

  if (itineraryData) {
    const { data: items } = await supabase
      .from("itinerary_items")
      .select("title")
      .eq("itinerary_id", itineraryData.id)
      .eq("item_type", "destination")
      .maybeSingle();

    if (items) {
      destinationText = items.title;
    }
  }

  // 3. Fetch user preferences
  const { data: prefs } = await supabase
    .from("user_preferences")
    .select("interests, pace, budget, travel_style_prompt")
    .eq("user_id", user.id)
    .maybeSingle();

  // 4. Resolve and Upsert Destination
  const destinationCandidate = await resolveDestination(destinationText);
  if (!destinationCandidate) {
    return Response.json(
      { error: "Could not resolve destination" },
      { status: 400 },
    );
  }

  const { data: destination, error: destError } = await supabase
    .from("destinations")
    .upsert({
      owner_id: null, // Shared catalog row
      source: "google",
      external_id: destinationCandidate.externalId,
      name: destinationCandidate.name,
      country: destinationCandidate.country,
      admin_area: destinationCandidate.adminArea,
      description: destinationCandidate.description,
      location: `SRID=4326;POINT(${destinationCandidate.lng} ${destinationCandidate.lat})`,
      status: "active",
    }, {
      onConflict: "external_id"
    })
    .select("id, name")
    .single();

  if (destError || !destination) {
    return Response.json(
      { error: "Failed to save destination", details: destError },
      { status: 500 },
    );
  }

  // 4b. Update Trip with destination_id
  await supabase
    .from("trips")
    .update({ destination_id: destination.id })
    .eq("id", tripId);

  // 5. Generate Curated Places
  const curated = await generatePlaces({
    destination: destination.name,
    title: trip.title,
    startsOn: trip.starts_on,
    endsOn: trip.ends_on,
    interests: (prefs?.interests as string[]) || [],
    pace: (prefs?.pace as string) || undefined,
    budget: (prefs?.budget as string) || undefined,
    travelStylePrompt: (prefs?.travel_style_prompt as string) || undefined,
    lat: destinationCandidate.lat,
    lng: destinationCandidate.lng,
  });

  // 6. Map and Upsert Places
  const placesToUpsert = curated.map((p) => ({
    owner_id: null, // Shared catalog row
    destination_id: destination.id,
    source: "google",
    external_id: p.externalId,
    name: p.name,
    description: p.description, // Neutral description for catalog
    category: p.category,
    address: p.address,
    location: `SRID=4326;POINT(${p.lng} ${p.lat})`,
    default_duration_minutes: p.defaultDurationMinutes,
    primary_type: p.primaryType,
    types: p.types,
    summary: p.summary,
    rating: p.rating,
    user_ratings_total: p.userRatingsTotal,
    quality_score: p.qualityScore,
    popularity: p.popularity,
    status: "active",
  }));

  const { data: insertedPlaces, error: placesError } = await supabase
    .from("places")
    .upsert(placesToUpsert, {
      onConflict: "destination_id,external_id"
    })
    .select();

  if (placesError) {
    return Response.json(
      { error: "Failed to save places", details: placesError },
      { status: 500 },
    );
  }

  return Response.json({
    destination: destination.name,
    inserted: insertedPlaces.length,
    places: insertedPlaces,
  });
}
