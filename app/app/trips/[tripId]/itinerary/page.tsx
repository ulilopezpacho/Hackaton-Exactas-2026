import { notFound } from "next/navigation";

import { ItineraryExplorer } from "@/components/trips/itinerary-explorer";
import { getTrip } from "@/lib/trips/data";

export default async function ItineraryPage({
  params,
}: PageProps<"/app/trips/[tripId]/itinerary">) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);
  const firstDay = trip?.days[0];

  if (!trip || !firstDay) {
    notFound();
  }

  return <ItineraryExplorer selectedDay={firstDay} trip={trip} />;
}
