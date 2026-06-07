import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapPinnedIcon,
  PlaneTakeoffIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getTripsOverview } from "@/lib/trips/overview";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value)).replace(".", "");
}

export default async function HomePage() {
  const { recentTrips, stats, upcomingTrip } = await getTripsOverview();
  const statCards = [
    { label: "Viajes", value: String(stats.trips) },
    { label: "Borradores", value: String(stats.drafts) },
    { label: "Lugares", value: String(stats.places) },
  ];

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 py-8 md:py-10">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="overflow-hidden rounded-[20px] border border-primary/20 bg-primary text-primary-foreground">
          <div className="relative min-h-80 p-6 md:p-9">
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(118deg,transparent_0_25%,rgba(255,255,255,.2)_25%_25.5%,transparent_25.5%_52%,rgba(255,255,255,.15)_52%_52.5%,transparent_52.5%),linear-gradient(28deg,transparent_0_42%,rgba(255,255,255,.15)_42%_42.5%,transparent_42.5%)]" />
            <div className="absolute -right-20 -top-24 size-72 rounded-full border border-white/20" />
            <div className="absolute -bottom-40 right-20 size-80 rounded-full border border-white/15" />
            <div className="relative flex min-h-64 flex-col justify-end">
              <div>
                <h1 className="max-w-2xl font-heading text-5xl leading-[0.98] font-medium text-balance md:text-7xl">
                  Decinos qué querés ver. Armamos el viaje.
                </h1>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    className="bg-card text-foreground hover:bg-secondary"
                    nativeButton={false}
                    render={<Link href="/app/trips/new/destination" />}
                    variant="secondary"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Crear viaje
                  </Button>
                  <Button
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:border-primary-foreground/50 hover:bg-primary-foreground/10 hover:text-primary-foreground"
                    nativeButton={false}
                    render={<Link href="/app/trips" />}
                    variant="outline"
                  >
                    Ver mis trips
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 p-4">
            {statCards.map((stat) => (
              <div
                className="border-l border-primary-foreground/25 px-4 py-2 first:border-l-0"
                key={stat.label}
              >
                <p className="text-2xl font-semibold text-primary-foreground" data-numeric>
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-primary-foreground/70">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <Card>
          {upcomingTrip ? (
            <>
              <CardHeader>
                <Badge className="w-fit" variant="success">
                  Próximo viaje
                </Badge>
                <CardTitle className="font-heading text-4xl font-medium">{upcomingTrip.city}</CardTitle>
                <CardDescription>
                  {upcomingTrip.country} · {upcomingTrip.tone}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3">
                    <CalendarDaysIcon className="size-4" />
                    <span>{upcomingTrip.dates}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ClockIcon className="size-4" />
                    <span>{upcomingTrip.days}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <MapPinnedIcon className="size-4" />
                    <span>{upcomingTrip.places}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    nativeButton={false}
                    render={<Link href={upcomingTrip.href} />}
                  >
                    Abrir
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <Badge className="w-fit" variant="secondary">
                  Próximo viaje
                </Badge>
                <CardTitle className="text-3xl">Sin viajes próximos</CardTitle>
                <CardDescription>
                  Cuando tengas un itinerario activo, va a aparecer acá.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button
                  nativeButton={false}
                  render={<Link href="/app/trips/new/destination" />}
                >
                  Crear viaje
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="inline-flex items-center gap-2">
            <PlaneTakeoffIcon className="size-4" />
            Actividad reciente
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {recentTrips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Todavía no hay viajes para mostrar.
            </p>
          ) : recentTrips.map((trip) => (
            <div className="grid gap-1 border-b border-border pb-4 last:border-b-0 last:pb-0" key={trip.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">{trip.city}</p>
                <time className="text-xs text-muted-foreground">{formatUpdatedAt(trip.updatedAt)}</time>
              </div>
              <p className="text-sm text-muted-foreground">{trip.tone}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </section>
  );
}
