import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  CompassIcon,
  MapPinnedIcon,
  PlaneTakeoffIcon,
  PlusIcon,
  RouteIcon,
  SparklesIcon,
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

const shortcuts = [
  {
    icon: PlusIcon,
    title: "Crear viaje",
    description: "Elegí destino, fechas y preferencias para armar una ruta nueva.",
    href: "/app/trips/new/destination",
  },
  {
    icon: RouteIcon,
    title: "Ver mis trips",
    description: "Revisá borradores, viajes próximos e itinerarios terminados.",
    href: "/app/trips",
  },
  {
    icon: CompassIcon,
    title: "Preferencias",
    description: "Ajustá ritmo, intereses y estilo de viaje para futuras propuestas.",
    href: "/app/profile/preferences",
  },
];

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
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative min-h-72 bg-linear-to-br from-[#E3B79C] to-[#B05E40] p-6 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_8%,rgba(255,255,255,0.35),rgba(255,255,255,0)_55%)]" />
            <div className="absolute inset-0 bg-linear-to-t from-foreground/35 to-transparent" />
            <div className="relative flex flex-col justify-between gap-16">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-card/90 uppercase tracking-[0.16em] text-foreground" variant="secondary">
                  <SparklesIcon data-icon="inline-start" />
                  Nuevo
                </Badge>
              </div>
              <div className="text-primary-foreground">
                <h1 className="max-w-2xl font-heading text-4xl leading-[1.04] font-semibold text-balance md:text-6xl">
                  Decinos qué querés ver. Armamos el viaje.
                </h1>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    className="h-11 rounded-full bg-card px-5 text-foreground hover:bg-card/90"
                    render={<Link href="/app/trips/new/destination" />}
                    variant="secondary"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Crear viaje
                  </Button>
                  <Button
                    className="h-11 rounded-full border-card/70 bg-transparent px-5 text-primary-foreground hover:bg-card/10"
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
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {statCards.map((stat) => (
              <div
                className="rounded-xl border border-border bg-background/70 px-4 py-3"
                key={stat.label}
              >
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card>
          {upcomingTrip ? (
            <>
              <CardHeader>
                <Badge className="w-fit rounded-md bg-accent text-accent-foreground" variant="secondary">
                  Próximo viaje
                </Badge>
                <CardTitle className="text-3xl">{upcomingTrip.city}</CardTitle>
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
                  <Button className="rounded-full" render={<Link href={upcomingTrip.href} />}>
                    Abrir
                  </Button>
                </div>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <Badge className="w-fit rounded-md bg-accent text-accent-foreground" variant="secondary">
                  Próximo viaje
                </Badge>
                <CardTitle className="text-3xl">Sin viajes próximos</CardTitle>
                <CardDescription>
                  Cuando tengas un itinerario activo, va a aparecer acá.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="rounded-full" render={<Link href="/app/trips/new/destination" />}>
                  Crear viaje
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <SparklesIcon data-icon="inline-start" />
              Rumbo
            </Badge>
            <Badge variant="outline">Planificador inteligente</Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;

            return (
              <Link className="block" href={shortcut.href} key={shortcut.title}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:ring-primary/30">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{shortcut.title}</CardTitle>
                    <CardDescription>{shortcut.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
          </div>
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
              <div className="grid gap-1 border-b pb-4 last:border-b-0 last:pb-0" key={trip.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{trip.city}</p>
                  <time className="text-xs text-muted-foreground">{formatUpdatedAt(trip.updatedAt)}</time>
                </div>
                <p className="text-sm text-muted-foreground">{trip.tone}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
