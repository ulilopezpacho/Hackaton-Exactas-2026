import { notFound, redirect } from "next/navigation";

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

  redirect(
    `/app/trips/${trip.id}/itinerary/${firstDay.dayNumber}`,
  );
}
