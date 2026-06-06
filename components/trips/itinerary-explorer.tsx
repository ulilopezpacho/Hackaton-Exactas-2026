"use client";

import Link from "next/link";
import {
  Clock3Icon,
  ListIcon,
  MapIcon,
  NavigationIcon,
  PlayIcon,
  SparklesIcon,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { GoogleTripMap } from "@/components/trips/google-trip-map";
import { PlaceArt } from "@/components/trips/place-art";
import { ShareTripButton } from "@/components/trips/share-trip-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  ItineraryDayDto,
  ItineraryItemDto,
  TripDto,
} from "@/lib/trips/data";
import { cn } from "@/lib/utils";

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes}` : `${hours} h`;
}

function PlaceItem({
  item,
  selected,
  onSelect,
}: {
  item: ItineraryItemDto;
  onSelect?: (itemId: string) => void;
  selected?: boolean;
}) {
  return (
    <button
      className="w-full text-left"
      onClick={() => onSelect?.(item.id)}
      type="button"
    >
      <Card
        className={cn(
          "transition duration-200 hover:-translate-y-0.5 hover:ring-primary/30",
          selected && "ring-2 ring-primary",
        )}
        size="sm"
      >
        <CardContent className="flex gap-3">
          <PlaceArt
            className="size-16 shrink-0 rounded-xl"
            seed={item.place?.id ?? item.id}
          />
          <div className="min-w-0 flex-1">
            <p className="font-heading text-base font-semibold">
              {item.place?.name ?? item.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {item.place?.category ? (
                <Badge variant="secondary">{item.place.category}</Badge>
              ) : null}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Clock3Icon className="size-3" />
                {formatDuration(item.durationMinutes)}
              </span>
            </div>
            {item.description ? (
              <p className="mt-2 text-xs font-medium text-primary">
                {item.description}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </button>
  );
}

function Timeline({ day }: { day: ItineraryDayDto }) {
  const visibleItems = day.items.filter((item) => item.itemType !== "transfer");

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="font-heading text-2xl font-semibold">{day.title}</h2>
        <span className="text-sm capitalize text-muted-foreground">
          {day.dateLabel}
        </span>
      </div>

      <div className="grid gap-0">
        {day.items.map((item, itemIndex) => {
          if (item.itemType === "transfer") {
            return (
              <div
                className="grid grid-cols-[3.5rem_1.25rem_1fr] gap-2"
                key={item.id}
              >
                <div />
                <div className="relative">
                  <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
                </div>
                <div className="flex items-center gap-2 py-3 text-xs font-medium text-muted-foreground">
                  <NavigationIcon className="size-4" />
                  <span>
                    {item.title}
                    {item.description ? ` · ${item.description}` : ""}
                  </span>
                </div>
              </div>
            );
          }

          const visibleIndex = day.items
            .slice(0, itemIndex + 1)
            .filter((candidate) => candidate.itemType !== "transfer").length - 1;
          const isRecommendation = item.itemType === "recommendation";
          const isFirst = visibleIndex === 0;
          const isLast = visibleIndex === visibleItems.length - 1;

          return (
            <div
              className="grid grid-cols-[3.5rem_1.25rem_1fr] gap-2"
              key={item.id}
            >
              <time
                className={cn(
                  "pt-3 text-right text-xs font-semibold tabular-nums",
                  isRecommendation && "text-primary",
                )}
              >
                {item.startTime}
              </time>
              <div className="relative">
                {!isFirst ? (
                  <div className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-border" />
                ) : null}
                {!isLast ? (
                  <div className="absolute bottom-0 left-1/2 top-3 w-px -translate-x-1/2 bg-border" />
                ) : null}
                <div
                  className={cn(
                    "absolute left-1/2 top-3 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
                    isRecommendation
                      ? "border-primary bg-background ring-1 ring-primary"
                      : "bg-primary ring-1 ring-primary",
                  )}
                />
              </div>
              <div className="min-w-0 pb-4">
                {isRecommendation ? (
                  <div className="rounded-2xl border border-dashed border-primary bg-primary/5 p-4">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary">
                      <SparklesIcon className="size-4" />
                      Hueco libre
                    </p>
                    <h3 className="mt-2 font-heading text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                ) : (
                  <PlaceItem item={item} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MapPanel({ day }: { day: ItineraryDayDto }) {
  const mappedItems = useMemo(
    () =>
      day.items.filter(
        (item) =>
          item.place?.latitude != null && item.place?.longitude != null,
      ),
    [day.items],
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    mappedItems[0]?.id ?? null,
  );
  const selectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <GoogleTripMap
        items={mappedItems}
        onSelect={selectItem}
        selectedItemId={selectedItemId}
      />
      <div className="flex gap-3 overflow-x-auto pb-2 lg:max-h-[32rem] lg:flex-col lg:overflow-y-auto lg:pb-0">
        {mappedItems.map((item) => (
          <div className="w-72 shrink-0 lg:w-auto" key={item.id}>
            <PlaceItem
              item={item}
              onSelect={selectItem}
              selected={selectedItemId === item.id}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ItineraryExplorer({
  selectedDay,
  trip,
}: {
  selectedDay: ItineraryDayDto;
  trip: TripDto;
}) {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between gap-4">
        <Button
          nativeButton={false}
          render={<Link href={`/app/trips/${trip.id}`} />}
          variant="ghost"
        >
          Volver al viaje
        </Button>
        <ShareTripButton title={`${trip.title} · itinerario`} />
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            {trip.title} · {trip.country}
          </p>
          <h1 className="mt-2 font-heading text-4xl font-semibold tracking-tight">
            {trip.dayCount} días, listos
          </h1>
        </div>
        <Button
          nativeButton={false}
          render={<Link href={`/app/trips/${trip.id}/travel`} />}
          size="lg"
        >
          <PlayIcon data-icon="inline-start" />
          Iniciar modo viaje
        </Button>
      </div>

      <nav
        aria-label="Días del itinerario"
        className="flex gap-2 overflow-x-auto pb-1"
      >
        {trip.days.map((day) => (
          <Button
            className="h-auto shrink-0 flex-col items-start rounded-2xl px-4 py-2"
            key={day.id}
            nativeButton={false}
            render={
              <Link
                href={`/app/trips/${trip.id}/itinerary/${day.dayNumber}`}
              />
            }
            variant={
              day.dayNumber === selectedDay.dayNumber ? "default" : "outline"
            }
          >
            <span>Día {day.dayNumber}</span>
            <span className="text-xs capitalize opacity-70">
              {day.dateLabel}
            </span>
          </Button>
        ))}
      </nav>

      <Tabs defaultValue="list">
        <TabsList className="w-full rounded-full sm:w-72">
          <TabsTrigger
            className="data-active:bg-white data-active:shadow-sm"
            value="list"
          >
            <ListIcon data-icon="inline-start" />
            Lista
          </TabsTrigger>
          <TabsTrigger
            className="data-active:bg-white data-active:shadow-sm"
            value="map"
          >
            <MapIcon data-icon="inline-start" />
            Mapa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="list">
          <Card className="mt-2">
            <CardHeader>
              <CardTitle>Día {selectedDay.dayNumber}</CardTitle>
              <CardDescription className="capitalize">
                {selectedDay.dateLabel} · {selectedDay.items.length} momentos
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Timeline day={selectedDay} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="map">
          <div className="mt-2">
            <MapPanel day={selectedDay} />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
