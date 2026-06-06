import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  MapIcon,
  PlusIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TripStatus = "draft" | "upcoming" | "completed";
type TripFilter = "all" | TripStatus;

type Trip = {
  actionHref: string;
  city: string;
  country: string;
  dates: string;
  days: string;
  href: string;
  places: string;
  stripeClass: string;
  status: TripStatus;
  tone: string;
};

const trips: Trip[] = [
  {
    actionHref: "/app/trips/lisboa/itinerary",
    city: "Lisboa",
    country: "Portugal",
    dates: "mar 2026",
    days: "4 días",
    href: "/app/trips/lisboa",
    places: "4 días completos",
    stripeClass: "from-[#A9C3D6] to-[#577E96]",
    status: "completed",
    tone: "Miradores, barrios y ritmo tranquilo",
  },
  {
    actionHref: "/app/trips/bariloche/itinerary",
    city: "Bariloche",
    country: "Argentina",
    dates: "ago 2026",
    days: "5 días",
    href: "/app/trips/bariloche",
    places: "8 lugares",
    stripeClass: "from-[#C7D4B2] to-[#6E8C56]",
    status: "upcoming",
    tone: "Lagos, senderos y chocolate",
  },
  {
    actionHref: "/app/trips/new/places",
    city: "Madrid",
    country: "España",
    dates: "12 - 14 jun",
    days: "3 días",
    href: "/app/trips/madrid",
    places: "5 lugares",
    stripeClass: "from-[#E7CBA1] to-[#BC8A52]",
    status: "draft",
    tone: "Arte, tapas y caminatas cortas",
  },
];

const statusCopy: Record<
  TripStatus,
  {
    action: string;
    label: string;
    tone: string;
  }
> = {
  completed: {
    action: "Ver itinerario",
    label: "Completado",
    tone: "text-muted-foreground",
  },
  draft: {
    action: "Seguir armando",
    label: "Borrador",
    tone: "bg-muted text-muted-foreground",
  },
  upcoming: {
    action: "Ver itinerario",
    label: "Próximo",
    tone: "border-border text-foreground",
  },
};

const filters: {
  href: string;
  label: string;
  value: TripFilter;
}[] = [
  { href: "/app/trips", label: "Todos", value: "all" },
  { href: "/app/trips?estado=borradores", label: "Borradores", value: "draft" },
  { href: "/app/trips?estado=proximos", label: "Próximos", value: "upcoming" },
  { href: "/app/trips?estado=completados", label: "Completados", value: "completed" },
];

const filterByParam: Record<string, TripFilter> = {
  borradores: "draft",
  completados: "completed",
  proximos: "upcoming",
};

function formatCount(count: number, filter: TripFilter) {
  if (filter === "draft") return `${count} ${count === 1 ? "borrador" : "borradores"}`;
  if (filter === "upcoming") return `${count} ${count === 1 ? "próximo" : "próximos"}`;
  if (filter === "completed") return `${count} ${count === 1 ? "completado" : "completados"}`;

  return `${count} ${count === 1 ? "viaje" : "viajes"}`;
}

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string | string[] }>;
}) {
  const params = await searchParams;
  const rawFilter = Array.isArray(params.estado) ? params.estado[0] : params.estado;
  const activeFilter = rawFilter ? filterByParam[rawFilter] ?? "all" : "all";
  const visibleTrips = activeFilter === "all"
    ? trips
    : trips.filter((trip) => trip.status === activeFilter);

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-normal">
            Mis viajes
          </h1>
        </div>
        <Button className="h-10 rounded-full px-5" render={<Link href="/app/trips/new/destination" />}>
          <PlusIcon data-icon="inline-start" />
          Nuevo viaje
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <Button
            className="shrink-0 rounded-full"
            key={filter.value}
            render={<Link href={filter.href} />}
            size="sm"
            variant={activeFilter === filter.value ? "default" : "outline"}
          >
            {filter.label}
          </Button>
        ))}
      </div>

      <div className="grid gap-5">
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between px-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-foreground">
              Tus viajes
            </p>
            <p className="text-sm font-medium text-muted-foreground">
              {formatCount(visibleTrips.length, activeFilter)}
            </p>
          </div>

          {visibleTrips.map((trip) => {
            const status = statusCopy[trip.status];
            const isDraft = trip.status === "draft";

            return (
              <Card
                className={cn(
                  "transition [--card-spacing:0px] hover:-translate-y-0.5 hover:ring-primary/30",
                  isDraft && "bg-secondary/35 hover:ring-muted-foreground/20",
                )}
                key={trip.city}
              >
                <CardContent className="grid p-0 sm:grid-cols-[7rem_1fr]">
                  <div
                    className={cn(
                      "relative min-h-24 bg-linear-to-br sm:min-h-full",
                      trip.stripeClass,
                    )}
                  >
                    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_8%,rgba(255,255,255,0.35),rgba(255,255,255,0)_55%)]" />
                    <div className="absolute inset-x-5 bottom-5 h-1.5 rounded-full bg-card/70" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-2xl">{trip.city}</CardTitle>
                          <Badge className={cn("rounded-md text-[0.65rem] uppercase tracking-[0.06em]", status.tone)} variant="outline">
                            {status.label}
                          </Badge>
                        </div>
                        <CardDescription>
                          {trip.country} · {trip.tone}
                        </CardDescription>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <CalendarDaysIcon className="size-4" />
                        {trip.dates}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <ClockIcon className="size-4" />
                        {trip.days}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapIcon className="size-4" />
                        {trip.places}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button className="rounded-full" render={<Link href={trip.actionHref} />} size="sm" variant="ghost">
                        {status.action}
                        <ArrowRightIcon data-icon="inline-end" />
                      </Button>
                      <Button className="rounded-full" render={<Link href={trip.href} />} size="sm" variant={isDraft ? "ghost" : "outline"}>
                        Abrir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}
