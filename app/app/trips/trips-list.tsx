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
    tone: "bg-secondary text-muted-foreground",
  },
  draft: {
    label: "Borrador",
    tone: "bg-muted text-muted-foreground",
  },
  generating: {
    label: "Generando",
    tone: "bg-info text-info-foreground",
  },
  ongoing: {
    label: "En viaje",
    tone: "bg-success text-success-foreground",
  },
  upcoming: {
    label: "Próximo",
    tone: "bg-primary/10 text-primary",
  },
};

const filters: {
  label: string;
  value: TripFilter;
}[] = [
  { label: "Todos", value: "all" },
  { label: "Borradores", value: "draft" },
  { label: "Generando", value: "generating" },
  { label: "En viaje", value: "ongoing" },
  { label: "Próximos", value: "upcoming" },
  { label: "Completados", value: "completed" },
];

function formatCount(count: number, filter: TripFilter) {
  if (filter === "draft") return `${count} ${count === 1 ? "borrador" : "borradores"}`;
  if (filter === "generating") return `${count} ${count === 1 ? "generando" : "generando"}`;
  if (filter === "ongoing") return `${count} ${count === 1 ? "en viaje" : "en viaje"}`;
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
            <p className="text-sm font-semibold text-foreground">
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
                  "transition-colors [--card-spacing:0px] hover:border-primary/35",
                  isDraft && "bg-secondary/35 hover:border-border-strong",
                )}
                key={trip.id}
              >
                <CardContent className="grid p-0 sm:grid-cols-[7rem_1fr]">
                  <div
                    className={cn(
                      "relative min-h-24 overflow-hidden bg-linear-to-br sm:min-h-full",
                      trip.stripeClass,
                    )}
                  >
                    <div className="absolute inset-0 bg-primary/35 mix-blend-multiply" />
                    <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(115deg,transparent_0_30%,rgba(255,255,255,.5)_30%_31%,transparent_31%_58%,rgba(255,255,255,.3)_58%_59%,transparent_59%)]" />
                  </div>
                  <div className="flex min-w-0 flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-2xl">{trip.city}</CardTitle>
                          <Badge className={status.tone} variant="outline">
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
