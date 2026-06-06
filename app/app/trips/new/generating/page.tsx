import Link from "next/link";
import { CheckIcon, DatabaseIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";
import { redirect } from "next/navigation";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";

type GeneratingPageProps = {
  searchParams: Promise<{ tripId?: string }>;
};

export default async function GeneratingPage({ searchParams }: GeneratingPageProps) {
  const { tripId } = await searchParams;

  if (!tripId) {
    redirect("/app/trips/new/destination");
  }

  const supabase = await createClient();
  const [{ data: trip }, { data: itineraries }] = await Promise.all([
    supabase
      .from("trips")
      .select("id, title, starts_on, ends_on")
      .eq("id", tripId)
      .single(),
    supabase
      .from("itineraries")
      .select("id, day_number")
      .eq("trip_id", tripId)
      .eq("itinerary_type", "wizard_tentative")
      .order("day_number", { ascending: true }),
  ]);

  if (!trip) {
    redirect("/app/trips/new/destination?error=missing-trip");
  }

  const steps = [
    "Guardamos destino, fechas y wishlist",
    "Creamos los lugares en Supabase",
    `Materializamos ${itineraries?.length ?? 0} días tentativos`,
    "El agente puede tomarlo desde la base",
  ];

  return (
    <PageShell
      eyebrow="Armando tu viaje"
      title={`Diseñando ${trip.title} desde un borrador real`}
    >
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20">
            <SparklesIcon className="size-9" />
          </div>
          <div>
            <Badge variant="secondary">
              <DatabaseIcon data-icon="inline-start" />
              Itinerario tentativo guardado
            </Badge>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              Esta pantalla queda como transición hacia la parte agentic. La
              base ya contiene el viaje y los bloques horarios iniciales.
            </p>
          </div>
          <div className="grid w-full max-w-md gap-3 text-left">
            {steps.map((step, index) => (
              <div className="flex items-center gap-3 text-sm" key={step}>
                <span className="flex size-7 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
                  {index === steps.length - 1 ? (
                    <RefreshCwIcon className="size-3 animate-spin" />
                  ) : (
                    <CheckIcon className="size-3" />
                  )}
                </span>
                {step}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              nativeButton={false}
              render={<Link href={`/app/trips/${trip.id}/itinerary`} />}
              variant="secondary"
            >
              Ver itinerario
            </Button>
            <Button nativeButton={false} render={<Link href="/app/trips" />}>
              Volver a viajes
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
