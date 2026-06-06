import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";

import { PageShell, WorkCard, WorkGrid } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";

type TripPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

export default async function TripPage({ params }: TripPageProps) {
  const { tripId } = await params;

  return (
    <PageShell
      actions={
        <Button render={<Link href={`/app/trips/${tripId}/itinerary`} />}>
          Ver itinerario
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      }
      eyebrow="Viaje"
      title="Madrid"
    >
      <WorkGrid>
        <WorkCard
          description="Lista y mapa del viaje generado."
          href={`/app/trips/${tripId}/itinerary`}
          owner="equipo itinerario"
          status="Mock"
          title="Itinerario"
        />
        <WorkCard
          description="Experiencia durante el viaje, replanificación y progreso."
          href={`/app/trips/${tripId}/travel`}
          owner="equipo modo viaje"
          status="Mock"
          title="Modo viaje"
        />
        <WorkCard
          description="Destino, fechas, visibilidad y configuración del viaje."
          href={`/app/trips/${tripId}/settings`}
          owner="equipo viajes"
          title="Settings"
        />
      </WorkGrid>
    </PageShell>
  );
}
