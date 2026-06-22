import { redirect } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

import { createClient } from "@/utils/supabase/server";
import { ItineraryWizard } from "@/components/app/itinerary-wizard";
import {
  DEFAULT_PLACE_PRIORITY,
  isPlacePriority,
  type PlacePriority,
} from "@/lib/places/priority";

type GeneratingPageProps = {
  searchParams: Promise<{
    placeId?: string | string[];
    priority?: string | string[];
    tripId?: string;
  }>;
};

export default async function GeneratingPage({ searchParams }: GeneratingPageProps) {
  const { placeId, priority, tripId } = await searchParams;

  if (!tripId) {
    redirect("/app/trips/new/destination");
  }

  const supabase = await createClient();
  
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, starts_on, ends_on")
    .eq("id", tripId)
    .single();

  if (!trip) {
    redirect("/app/trips/new/destination?error=missing-trip");
  }

  const { data: generatedItinerary } = await supabase
    .from("itineraries")
    .select("id")
    .eq("trip_id", trip.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (generatedItinerary) {
    redirect(`/app/trips/${trip.id}/itinerary`);
  }

  // `placeId` and `priority` arrive as index-aligned repeated params. Dedup by
  // placeId (preserving order) and build the placeId → priority map.
  const rawPlaceIds = typeof placeId === "string" ? [placeId] : placeId ?? [];
  const rawPriorities = typeof priority === "string" ? [priority] : priority ?? [];
  const placeIds: string[] = [];
  const priorities: Record<string, PlacePriority> = {};
  rawPlaceIds.forEach((id, index) => {
    if (priorities[id] !== undefined) return;
    placeIds.push(id);
    const value = rawPriorities[index];
    priorities[id] = isPlacePriority(value) ? value : DEFAULT_PLACE_PRIORITY;
  });

  const dayCount = differenceInDays(parseISO(trip.ends_on), parseISO(trip.starts_on)) + 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <ItineraryWizard
          tripId={trip.id}
          placeIds={placeIds}
          priorities={priorities}
          tripTitle={trip.title}
          dayCount={dayCount}
        />
      </div>
    </div>
  );
}
