import { redirect } from "next/navigation";

type TripPreferencesPageProps = {
  searchParams: Promise<{ tripId?: string }>;
};

export default async function TripPreferencesPage({
  searchParams,
}: TripPreferencesPageProps) {
  const { tripId } = await searchParams;
  const params = new URLSearchParams();

  if (tripId) {
    params.set("tripId", tripId);
  }

  redirect(`/app/trips/new/places?${params}`);
}
