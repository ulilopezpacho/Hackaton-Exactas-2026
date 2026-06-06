import { notFound } from "next/navigation";

import { TravelMode } from "@/components/trips/travel-mode";
import { getTrip } from "@/lib/trips/data";

export default async function TravelPage({
  params,
}: PageProps<"/app/trips/[tripId]/travel">) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);

  if (!trip) {
    notFound();
  }

  return (
    <div data-travel-mode-view>
      <TravelMode trip={trip} />
    </div>
  );
}
