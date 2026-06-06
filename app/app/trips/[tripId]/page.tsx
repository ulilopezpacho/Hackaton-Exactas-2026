import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  MapPinnedIcon,
  PlayIcon,
  SettingsIcon,
} from "lucide-react";
import { notFound } from "next/navigation";

import { PlaceArt } from "@/components/trips/place-art";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTrip } from "@/lib/trips/data";

function formatDateRange(startsOn: string, endsOn: string) {
  const formatter = new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(`${startsOn}T12:00:00Z`))} – ${formatter.format(
    new Date(`${endsOn}T12:00:00Z`),
  )}`;
}

export default async function TripPage({
  params,
}: PageProps<"/app/trips/[tripId]">) {
  const { tripId } = await params;
  const trip = await getTrip(tripId);

  if (!trip) {
    notFound();
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
      <div className="relative min-h-80 overflow-hidden rounded-[2rem]">
        <PlaceArt className="absolute inset-0" seed={trip.title} />
        <div className="absolute inset-0 bg-linear-to-t from-black/75 via-black/20 to-transparent" />
        <div className="relative flex min-h-80 flex-col justify-end p-6 text-white sm:p-9">
          <Badge className="mb-4 bg-white/90 text-foreground" variant="secondary">
            {trip.travelStatus === "ongoing"
              ? "Viaje en curso"
              : trip.travelStatus === "completed"
                ? "Viaje completado"
                : "Viaje confirmado"}
          </Badge>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/80">
            {trip.country}
          </p>
          <h1 className="mt-2 max-w-2xl font-heading text-5xl font-semibold tracking-tight sm:text-6xl">
            {trip.title}
          </h1>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-white/90">
            <span className="inline-flex items-center gap-2">
              <CalendarDaysIcon className="size-4" />
              {formatDateRange(trip.startsOn, trip.endsOn)}
            </span>
            <span>{trip.dayCount} días</span>
            <span>{trip.placeCount} lugares</span>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button
              nativeButton={false}
              render={<Link href={`/app/trips/${trip.id}/itinerary`} />}
              size="lg"
            >
              Ver itinerario
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
            <Button
              className="border-white/30 bg-white/10 text-white hover:bg-white/20"
              nativeButton={false}
              render={<Link href={`/app/trips/${trip.id}/travel`} />}
              size="lg"
              variant="outline"
            >
              <PlayIcon data-icon="inline-start" />
              {trip.travelStatus === "ongoing"
                ? "Reanudar viaje"
                : "Modo viaje"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            description: `${trip.days.length} jornadas con horarios y traslados.`,
            href: `/app/trips/${trip.id}/itinerary`,
            icon: MapPinnedIcon,
            label: "Abrir itinerario",
            title: "Plan día por día",
          },
          {
            description: "Avanzá entre paradas y replanificá ante cambios.",
            href: `/app/trips/${trip.id}/travel`,
            icon: PlayIcon,
            label: "Iniciar modo viaje",
            title: "Durante el viaje",
          },
          {
            description: "Revisá destino, fechas y visibilidad del viaje.",
            href: `/app/trips/${trip.id}/settings`,
            icon: SettingsIcon,
            label: "Ver ajustes",
            title: "Configuración",
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle>{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
              <CardAction>
                <item.icon className="size-5 text-primary" />
              </CardAction>
            </CardHeader>
            <CardContent>
              <Button
                nativeButton={false}
                render={<Link href={item.href} />}
                variant="link"
              >
                {item.label}
                <ArrowRightIcon data-icon="inline-end" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
