import { notFound } from "next/navigation";

import { ItineraryExplorer } from "@/components/trips/itinerary-explorer";
import { getTrip } from "@/lib/trips/data";

export default async function ItineraryDayPage({
  params,
}: PageProps<"/app/trips/[tripId]/itinerary/[dayNumber]">) {
  const { dayNumber, tripId } = await params;
  const parsedDayNumber = Number(dayNumber);

  if (!Number.isInteger(parsedDayNumber) || parsedDayNumber < 1) {
    notFound();
  }

  const trip = await getTrip(tripId);
  const selectedDay = trip?.days.find(
    (day) => day.dayNumber === parsedDayNumber,
  );

  if (!trip || !selectedDay) {
    notFound();
  }

  return <ItineraryExplorer selectedDay={selectedDay} trip={trip} />;
}
