"use client";

import Link from "next/link";
import {
  ChevronLeftIcon,
  Clock3Icon,
  ListIcon,
  MapIcon,
  NavigationIcon,
  PlayIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
              <span className="text-xs font-semibold tabular-nums text-foreground">
                {item.startTime}
              </span>
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
  const railRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLDivElement>());
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId);
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      return;
    }

    cardRefs.current.get(selectedItemId)?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [selectedItemId]);

  const selectCenteredCard = useCallback(() => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    if (scrollTimerRef.current !== null) {
      clearTimeout(scrollTimerRef.current);
    }

    scrollTimerRef.current = setTimeout(() => {
      const railCenter = rail.getBoundingClientRect().left + rail.clientWidth / 2;
      let nearestItemId: string | null = null;
      let nearestDistance = Number.POSITIVE_INFINITY;

      cardRefs.current.forEach((card, itemId) => {
        const bounds = card.getBoundingClientRect();
        const distance = Math.abs(bounds.left + bounds.width / 2 - railCenter);

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestItemId = itemId;
        }
      });

      if (nearestItemId) {
        setSelectedItemId(nearestItemId);
      }
    }, 100);
  }, []);

  useEffect(
    () => () => {
      if (scrollTimerRef.current !== null) {
        clearTimeout(scrollTimerRef.current);
      }
    },
    [],
  );

  return (
    <div className="grid min-w-0 gap-4">
      <GoogleTripMap
        items={mappedItems}
        onSelect={selectItem}
        selectedItemId={selectedItemId}
      />
      <div
        aria-label="Paradas del mapa"
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-[9%] pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={selectCenteredCard}
        ref={railRef}
      >
        {mappedItems.map((item) => {
          const selected = selectedItemId === item.id;

          return (
          <div
            className={cn(
              "w-[82%] shrink-0 snap-center transition duration-200 sm:w-[62%]",
              selected
                ? "scale-100 opacity-100"
                : "scale-[0.94] cursor-pointer opacity-55",
            )}
            key={item.id}
            ref={(card) => {
              if (card) {
                cardRefs.current.set(item.id, card);
              } else {
                cardRefs.current.delete(item.id);
              }
            }}
          >
            <PlaceItem
              item={item}
              onSelect={selectItem}
              selected={selected}
            />
          </div>
          );
        })}
      </div>
    </div>
  );
}

export function ItineraryExplorer({
  immersive = false,
  selectedDay,
  trip,
}: {
  immersive?: boolean;
  selectedDay: ItineraryDayDto;
  trip: TripDto;
}) {
  const router = useRouter();

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }

    router.push(`/app/trips/${trip.id}`);
  }

  return (
    <section
      className={cn(
        "mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8",
        immersive && "pb-28 sm:pb-32",
      )}
      data-itinerary-day-view={immersive ? "" : undefined}
    >
      <div className="flex items-center justify-between gap-4">
        {immersive ? (
          <Button
            aria-label="Volver"
            className="size-10 rounded-full border bg-card shadow-sm"
            onClick={goBack}
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-5" />
          </Button>
        ) : (
          <Button
            nativeButton={false}
            render={<Link href={`/app/trips/${trip.id}`} />}
            variant="ghost"
          >
            Volver al viaje
          </Button>
        )}
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
        {!immersive ? (
          <Button
            nativeButton={false}
            render={<Link href={`/app/trips/${trip.id}/travel`} />}
            size="lg"
          >
            <PlayIcon data-icon="inline-start" />
            Iniciar modo viaje
          </Button>
        ) : null}
      </div>

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

      {immersive ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          <div className="mx-auto w-full max-w-6xl">
            <Button
              className="w-full rounded-full"
              nativeButton={false}
              render={<Link href={`/app/trips/${trip.id}/travel`} />}
              size="lg"
            >
              <PlayIcon data-icon="inline-start" />
              Iniciar modo viaje
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
