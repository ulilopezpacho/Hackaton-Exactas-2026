import { redirect } from "next/navigation";

import { PageShell } from "@/components/app/page-shell";
import { createClient } from "@/utils/supabase/server";

import { TripPlacesForm } from "./trip-places-form";

type PlacesPageProps = {
  searchParams: Promise<{ error?: string; tripId?: string }>;
};

export default async function PlacesPage({ searchParams }: PlacesPageProps) {
  const { error, tripId } = await searchParams;

  if (!tripId) {
    redirect("/app/trips/new/destination");
  }

  const supabase = await createClient();
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, starts_on, ends_on, route_customization_prompt")
    .eq("id", tripId)
    .single();

  if (!trip) {
    redirect("/app/trips/new/destination?error=missing-trip");
  }

  return (
    <PageShell eyebrow="Wishlist" title="Creá tu lista de prioridades">
      {error ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          No pudimos guardar el contexto para generar el viaje. Probá de nuevo.
        </p>
      ) : null}
      <TripPlacesForm
        initialNotes={trip.route_customization_prompt ?? ""}
        trip={{
          endsOn: trip.ends_on,
          id: trip.id,
          startsOn: trip.starts_on,
          title: trip.title,
        }}
      />
    </PageShell>
  );
}
