import Link from "next/link";
import { ArrowLeftIcon, StarIcon } from "lucide-react";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type TravelPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

const upcoming = ["Museo del Prado", "Parque del Retiro"];

export default async function TravelPage({ params }: TravelPageProps) {
  const { tripId } = await params;

  return (
    <PageShell
      actions={
        <Button
          nativeButton={false}
          render={<Link href={`/app/trips/${tripId}/itinerary`} />}
          variant="outline"
        >
          <ArrowLeftIcon data-icon="inline-start" />
          Itinerario
        </Button>
      }
      eyebrow="Modo viaje · Día 1"
      title="Ahora: Plaza Mayor"
    >
      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Próxima parada</CardTitle>
            <CardDescription>Mercado de San Miguel · 4 min a pie</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-xl bg-muted p-5">
              <p className="text-sm text-muted-foreground">Llegada estimada</p>
              <p className="text-3xl font-semibold">13:15</p>
            </div>
            <Button className="h-11">Marcar como visitado</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <StarIcon className="size-4" />
              Replanificación
            </CardTitle>
            <CardDescription>Acciones del sheet del mock.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2">
            <Button variant="outline">Acortar próximas paradas</Button>
            <Button variant="outline">Recalcular ruta</Button>
            <Button variant="outline">Mantener plan</Button>
          </CardContent>
        </Card>
      </div>
      <section className="grid gap-3 md:grid-cols-2">
        {upcoming.map((place) => (
          <Card key={place} size="sm">
            <CardContent className="flex items-center justify-between">
              <span className="font-semibold">{place}</span>
              <Badge variant="outline">Pendiente</Badge>
            </CardContent>
          </Card>
        ))}
      </section>
    </PageShell>
  );
}
