import { NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { scorePlaces } from "@/lib/places/score";
import type { PlaceForScoring, UserPreferencesForScoring } from "@/lib/places/score";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { placeIds, tripId } = body as {
    placeIds: string[];
    tripId: string;
  };

  if (!placeIds?.length || !tripId) {
    return Response.json(
      { error: "placeIds (non-empty array) and tripId are required" },
      { status: 400 },
    );
  }

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("route_customization_prompt")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .single();

  if (tripError || !trip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const { data: placesRaw, error: placesError } = await (supabase as any)
    .from("places")
    .select(
      "id, name, description, category, rating, user_ratings_total, quality_score, popularity",
    )
    .in("id", placeIds)
    .eq("status", "active");

  if (placesError) {
    return Response.json(
      { error: "Failed to fetch places", details: placesError },
      { status: 500 },
    );
  }

  const places: PlaceForScoring[] = (placesRaw ?? []).map(
    (p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      rating: p.rating,
      userRatingsTotal: p.user_ratings_total,
      qualityScore: p.quality_score,
      popularity: p.popularity,
    }),
  );

  const { data: userPrefs } = await supabase
    .from("user_preferences")
    .select("interests, pace, budget, travel_style_prompt")
    .eq("user_id", user.id)
    .maybeSingle();

  const prefsForScoring: UserPreferencesForScoring = {
    interests: (userPrefs?.interests as string[]) ?? [],
    pace: (userPrefs?.pace as string) ?? null,
    budget: (userPrefs?.budget as string) ?? null,
    travelStylePrompt: (userPrefs?.travel_style_prompt as string) ?? null,
  };

  const scored = await scorePlaces({
    places,
    userPreferences: prefsForScoring,
    tripCustomizationPrompt:
      (trip as any).route_customization_prompt ?? undefined,
  });

  return Response.json({ scores: scored });
}
