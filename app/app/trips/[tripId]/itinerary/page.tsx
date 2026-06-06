import Link from "next/link";
import { MapIcon, Share2Icon } from "lucide-react";

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

type ItineraryPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

const days = [
  ["1", "Madrid de los Austrias", "Versión equilibrada"],
  ["2", "Arte y atardecer", "Versión arte"],
  ["3", "Antes del vuelo", "Versión express"],
];

const stops = [
  ["10:00", "Palacio Real", "Historia · 2 h"],
  ["12:10", "Plaza Mayor", "Clásico · 1 h"],
  ["13:15", "Mercado de San Miguel", "Almuerzo"],
  ["15:00", "Museo del Prado", "Arte · 3 h"],
  ["18:10", "Parque del Retiro", "Aire libre · 1 h 30"],
];

export default async function ItineraryPage({ params }: ItineraryPageProps) {
  const { tripId } = await params;

  return (
    <PageShell
      actions={
        <div className="flex gap-2">
          <Button size="icon" variant="outline">
            <Share2Icon />
          </Button>
          <Button render={<Link href={`/app/trips/${tripId}/travel`} />}>
            Iniciar modo viaje
          </Button>
        </div>
      }
      eyebrow="Madrid · España · Versión equilibrada"
      title="3 días, listos"
    >
      <div className="flex gap-2 overflow-x-auto">
        {days.map(([day, , version]) => (
          <Button
            className="h-auto shrink-0 flex-col items-start rounded-xl px-4 py-2"
            key={day}
            render={<Link href={`/app/trips/${tripId}/itinerary/${day}`} />}
            variant={day === "1" ? "default" : "outline"}
          >
            <span>Día {day}</span>
            <span className="text-xs opacity-70">{version}</span>
          </Button>
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>{days[0][1]}</CardTitle>
            <CardDescription>Día 1 · jue 12 jun</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            {stops.map(([time, title, meta]) => (
              <div className="grid grid-cols-[4rem_1fr] gap-3" key={title}>
                <time className="pt-3 text-right text-xs font-semibold">{time}</time>
                <Card size="sm">
                  <CardContent>
                    <p className="font-semibold">{title}</p>
                    <p className="text-xs text-muted-foreground">{meta}</p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <MapIcon className="size-4" />
              Mapa
            </CardTitle>
            <CardDescription>Placeholder para el mapa real del día.</CardDescription>
          </CardHeader>
          <CardContent className="grid min-h-72 place-items-center rounded-lg bg-muted">
            <Badge variant="secondary">Ruta del Día 1</Badge>
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
