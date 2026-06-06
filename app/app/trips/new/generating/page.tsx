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
  const { data: trip } = await supabase
    .from("trips")
    .select("id, title, starts_on, ends_on, route_customization_prompt")
    .eq("id", tripId)
    .single();

  if (!trip) {
    redirect("/app/trips/new/destination?error=missing-trip");
  }

  const steps = [
    "Guardamos destino, fechas y wishlist",
    "Unimos tus notas con el orden de prioridades",
    "Dejamos el contexto en el viaje para el LLM",
    "El agente va a generar el plan final",
  ];

  return (
    <PageShell
      eyebrow="Armando tu viaje"
      title={`Preparando ${trip.title} para el generador`}
    >
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20">
            <SparklesIcon className="size-9" />
          </div>
          <div>
            <Badge variant="secondary">
              <DatabaseIcon data-icon="inline-start" />
              Contexto de generación guardado
            </Badge>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              La base contiene el viaje y el prompt de personalización. El
              itinerario todavía no existe: lo va a crear el flujo LLM.
            </p>
          </div>
          {trip.route_customization_prompt ? (
            <div className="max-h-44 w-full max-w-md overflow-y-auto rounded-xl border bg-muted/40 p-4 text-left text-xs leading-relaxed text-muted-foreground">
              {trip.route_customization_prompt}
            </div>
          ) : null}
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
            <Button nativeButton={false} render={<Link href="/app/trips" />}>
              Volver a viajes
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
