import { redirect } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

import { createClient } from "@/utils/supabase/server";
import { ItineraryWizard } from "@/components/app/itinerary-wizard";

type GeneratingPageProps = {
  searchParams: Promise<{ placeId?: string | string[]; tripId?: string }>;
};

export default async function GeneratingPage({ searchParams }: GeneratingPageProps) {
  const { placeId, tripId } = await searchParams;

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

  const placeIds = Array.from(
    new Set(typeof placeId === "string" ? [placeId] : placeId ?? []),
  );
  const dayCount = differenceInDays(parseISO(trip.ends_on), parseISO(trip.starts_on)) + 1;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <ItineraryWizard
          tripId={trip.id}
          placeIds={placeIds}
          tripTitle={trip.title}
          dayCount={dayCount}
        />
      </div>
    </div>
  );
}
