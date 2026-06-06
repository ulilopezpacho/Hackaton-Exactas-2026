import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type DayPageProps = {
  params: Promise<{
    dayNumber: string;
    tripId: string;
  }>;
};

export default async function ItineraryDayPage({ params }: DayPageProps) {
  const { dayNumber, tripId } = await params;

  return (
    <PageShell
      actions={
        <Button render={<Link href={`/app/trips/${tripId}/itinerary`} />} variant="outline">
          Ver todos los días
        </Button>
      }
      eyebrow="Itinerario"
      title={`Día ${dayNumber}`}
    >
      <Card>
        <CardHeader>
          <CardTitle>Detalle del día</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Badge className="w-fit" variant="secondary">
            Ruta específica para que un equipo trabaje el día individual
          </Badge>
          <p className="text-sm text-muted-foreground">
            Esta pantalla puede evolucionar a edición fina por día, variantes y
            recomendaciones para huecos libres.
          </p>
        </CardContent>
      </Card>
    </PageShell>
  );
}
