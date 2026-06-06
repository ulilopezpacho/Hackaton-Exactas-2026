"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import type { TripOverview, TripStatus } from "@/lib/trips/overview-types";
import { cn } from "@/lib/utils";

type TripFilter = "all" | TripStatus;

const statusCopy: Record<
  TripStatus,
  {
    label: string;
    tone: string;
  }
> = {
  completed: {
    label: "Completado",
    tone: "text-muted-foreground",
  },
  draft: {
    label: "Borrador",
    tone: "bg-muted text-muted-foreground",
  },
  upcoming: {
    label: "Próximo",
    tone: "border-border text-foreground",
  },
};

const filters: {
  label: string;
  value: TripFilter;
}[] = [
  { label: "Todos", value: "all" },
  { label: "Borradores", value: "draft" },
  { label: "Próximos", value: "upcoming" },
  { label: "Completados", value: "completed" },
];

function formatCount(count: number, filter: TripFilter) {
  if (filter === "draft") return `${count} ${count === 1 ? "borrador" : "borradores"}`;
  if (filter === "upcoming") return `${count} ${count === 1 ? "próximo" : "próximos"}`;
  if (filter === "completed") return `${count} ${count === 1 ? "completado" : "completados"}`;

  return `${count} ${count === 1 ? "viaje" : "viajes"}`;
}

export function TripsList({ trips }: { trips: TripOverview[] }) {
  const [activeFilter, setActiveFilter] = useState<TripFilter>("all");
  const visibleTrips = activeFilter === "all"
    ? trips
    : trips.filter((trip) => trip.status === activeFilter);

  return (
    <>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((filter) => (
          <Button
            aria-pressed={activeFilter === filter.value}
            className="shrink-0 rounded-full"
            key={filter.value}
            onClick={() => setActiveFilter(filter.value)}
            size="sm"
            type="button"
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

          {visibleTrips.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-3 p-6">
                <CardTitle className="text-2xl">Todavía no hay viajes</CardTitle>
                <CardDescription>
                  Creá tu primer viaje para empezar a guardar lugares e itinerarios.
                </CardDescription>
                <div>
                  <Button
                    className="rounded-full"
                    nativeButton={false}
                    render={<Link href="/app/trips/new/destination" />}
                  >
                    Crear viaje
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : visibleTrips.map((trip) => {
            const status = statusCopy[trip.status];
            const isDraft = trip.status === "draft";

            return (
              <Card
                className={cn(
                  "transition [--card-spacing:0px] hover:-translate-y-0.5 hover:ring-primary/30",
                  isDraft && "bg-secondary/35 hover:ring-muted-foreground/20",
                )}
                key={trip.id}
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
                      <Button
                        className="rounded-full"
                        nativeButton={false}
                        render={<Link href={trip.href} />}
                        size="sm"
                        variant={isDraft ? "ghost" : "outline"}
                      >
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
    </>
  );
}
