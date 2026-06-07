import { redirect } from "next/navigation";
import { differenceInDays, parseISO } from "date-fns";

import { createClient } from "@/utils/supabase/server";
import { ItineraryWizard } from "@/components/app/itinerary-wizard";

type GeneratingPageProps = {
  searchParams: Promise<{ tripId?: string }>;
};

export default async function GeneratingPage({ searchParams }: GeneratingPageProps) {
  const { tripId } = await searchParams;

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

  // Fetch the place IDs from the tentative itinerary items
  const { data: itineraries } = await supabase
    .from("itineraries")
    .select("id")
    .eq("trip_id", tripId)
    .eq("itinerary_type", "wizard_tentative");

  const itineraryIds = itineraries?.map((i) => i.id) ?? [];
  
  const { data: items } = await supabase
    .from("itinerary_items")
    .select("place_id")
    .in("itinerary_id", itineraryIds)
    .not("place_id", "is", null);

  const placeIds = Array.from(new Set((items ?? []).map((i) => i.place_id as string)));
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
