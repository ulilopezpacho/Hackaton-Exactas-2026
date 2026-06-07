"use client";

import {
  AlertTriangleIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
  ChevronLeftIcon,
  Clock3Icon,
  LockIcon,
  MapPinIcon,
  RefreshCwIcon,
  ScissorsIcon,
  SparklesIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GoogleTripMap } from "@/components/trips/google-trip-map";
import { PlaceArt } from "@/components/trips/place-art";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  ItineraryDayDto,
  ItineraryItemDto,
  TripDto,
} from "@/lib/trips/data";
import { cn } from "@/lib/utils";

type Scenario = "closed" | "overstay";
type Strategy = "recalculate" | "recommended" | "trim";

type RecommendedOperation = {
  durationMinutes?: number;
  enabled: boolean;
  id: string;
  itemId: string;
  label: string;
  previousDurationMinutes?: number;
  type: "remove" | "trim";
};

type RecommendationPreview = {
  explanation: string;
  operations: RecommendedOperation[];
  scenario: Scenario;
  strategy: Strategy;
};

function navigableItems(day: ItineraryDayDto) {
  return day.items.filter(
    (item) =>
      item.itemType === "place" || item.itemType === "recommendation",
  );
}

function itemName(item: ItineraryItemDto) {
  return item.place?.name ?? item.title;
}

function formatDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder}` : `${hours} h`;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(body.error ?? "No se pudo completar la acción");
  }

  return body;
}

function StartTravelSheet({ trip }: { trip: TripDto }) {
  const router = useRouter();
  const firstDay = trip.days.find((day) => navigableItems(day).length > 0);
  const [dayNumber, setDayNumber] = useState(firstDay?.dayNumber ?? 1);
  const selectedDay =
    trip.days.find((day) => day.dayNumber === dayNumber) ?? firstDay;
  const points = selectedDay ? navigableItems(selectedDay) : [];
  const [itemId, setItemId] = useState(points[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function selectDay(nextDayNumber: number) {
    const nextDay = trip.days.find((day) => day.dayNumber === nextDayNumber);
    setDayNumber(nextDayNumber);
    setItemId(nextDay ? navigableItems(nextDay)[0]?.id ?? "" : "");
  }

  async function startTravel() {
    if (!itemId) {
      return;
    }

    setPending(true);
    setError(null);

    try {
      const result = await readJson<{ tripId: string }>(
        await fetch(`/api/trips/${trip.id}/travel/start`, {
          body: JSON.stringify({ itemId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );

      if (result.tripId !== trip.id) {
        router.replace(`/app/trips/${result.tripId}/travel`);
      } else {
        router.refresh();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden">
      {selectedDay ? (
        <GoogleTripMap
          heightClassName="h-[calc(100vh-3.5rem)]"
          items={selectedDay.items}
          onSelect={setItemId}
          selectedItemId={itemId}
          showAllControl={false}
        />
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/10 via-transparent to-background" />

      <Sheet open>
        <SheetContent
          className="max-h-[84vh] overflow-y-auto rounded-t-[2rem] bg-background px-1 pb-4"
          showCloseButton={false}
          side="bottom"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
          <SheetHeader className="px-5 pb-2">
            <SheetTitle className="text-2xl font-semibold">
              ¿Dónde empezás?
            </SheetTitle>
            <SheetDescription>
              Elegí el día y el primer punto del modo viaje.
            </SheetDescription>
          </SheetHeader>

          <div className="grid gap-4 px-5">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {trip.days.map((day) => (
                <Button
                  className="h-auto shrink-0 flex-col items-start rounded-2xl px-4 py-2"
                  disabled={navigableItems(day).length === 0}
                  key={day.id}
                  onClick={() => selectDay(day.dayNumber)}
                  variant={day.dayNumber === dayNumber ? "default" : "outline"}
                >
                  <span>Día {day.dayNumber}</span>
                  <span className="text-xs capitalize opacity-70">
                    {day.dateLabel}
                  </span>
                </Button>
              ))}
            </div>

            <div className="grid gap-2">
              {points.map((item) => {
                const selected = item.id === itemId;

                return (
                  <button
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border bg-card p-3 text-left transition",
                      selected && "border-primary ring-2 ring-primary/20",
                    )}
                    key={item.id}
                    onClick={() => setItemId(item.id)}
                    type="button"
                  >
                    <PlaceArt
                      className="size-14 shrink-0 rounded-xl"
                      seed={item.place?.id ?? item.id}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">
                        {itemName(item)}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {item.startTime} · {formatDuration(item.durationMinutes)}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "size-5 rounded-full border-2",
                        selected && "border-primary bg-primary ring-2 ring-white",
                      )}
                    />
                  </button>
                );
              })}
            </div>

            {error ? (
              <p className="text-sm font-medium text-destructive">{error}</p>
            ) : null}
          </div>

          <SheetFooter className="px-5">
            <Button
              className="h-12 w-full"
              disabled={!itemId || pending}
              onClick={startTravel}
              size="lg"
            >
              {pending ? "Iniciando…" : "Iniciar modo viaje"}
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function ReplanOption({
  active,
  description,
  icon: Icon,
  onClick,
  title,
}: {
  active: boolean;
  description: string;
  icon: typeof ScissorsIcon;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition",
        active && "border-primary bg-primary/5 ring-2 ring-primary/15",
      )}
      onClick={onClick}
      type="button"
    >
      <span
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground",
          active && "bg-primary text-primary-foreground",
        )}
      >
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-base font-semibold">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <span
        className={cn(
          "size-5 rounded-full border-2",
          active && "border-primary bg-primary ring-2 ring-white",
        )}
      />
    </button>
  );
}

function ReplanSheet({
  currentItem,
  onApplied,
  open,
  setOpen,
  trip,
  upcoming,
}: {
  currentItem: ItineraryItemDto;
  onApplied: () => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  trip: TripDto;
  upcoming: ItineraryItemDto[];
}) {
  const [scenario, setScenario] = useState<Scenario>("overstay");
  const [strategy, setStrategy] = useState<Strategy>("trim");
  const [preview, setPreview] = useState<RecommendationPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    void fetch(`/api/trips/${trip.id}/travel/replan/preview`, {
      body: JSON.stringify({ scenario, strategy }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    })
      .then((response) => readJson<RecommendationPreview>(response))
      .then((result) => {
        if (!cancelled) {
          setPreview(result);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudo preparar la recomendación",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, scenario, strategy, trip.id]);

  function toggleOperation(id: string) {
    setPreview((current) =>
      current
        ? {
            ...current,
            operations: current.operations.map((operation) =>
              operation.id === id
                ? { ...operation, enabled: !operation.enabled }
                : operation,
            ),
          }
        : current,
    );
  }

  async function applyChanges() {
    setPending(true);
    setError(null);

    try {
      const operations =
        strategy === "recommended"
          ? (preview?.operations ?? [])
              .filter((operation) => operation.enabled)
              .map(({ durationMinutes, itemId, type }) => ({
                durationMinutes,
                itemId,
                type,
              }))
          : [];

      await readJson(
        await fetch(`/api/trips/${trip.id}/travel/replan/apply`, {
          body: JSON.stringify({ operations, strategy }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }),
      );
      setOpen(false);
      onApplied();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo replanificar",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Sheet onOpenChange={setOpen} open={open}>
      <SheetContent
        className="max-h-[90vh] overflow-y-auto rounded-t-[2rem] bg-background px-1 pb-4"
        side="bottom"
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" />
        <SheetHeader className="px-5 pb-2">
          <SheetTitle className="flex items-center gap-2 text-2xl font-semibold">
            <AlertTriangleIcon className="size-6 text-primary" />
            Replanificar
          </SheetTitle>
          <SheetDescription>
            Ajustá lo que queda sin perder la versión original.
          </SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-5">
          <div className="flex gap-2 overflow-x-auto">
            <Button
              onClick={() => setScenario("overstay")}
              variant={scenario === "overstay" ? "default" : "outline"}
            >
              <Clock3Icon data-icon="inline-start" />
              Me quedé de más
            </Button>
            <Button
              onClick={() => setScenario("closed")}
              variant={scenario === "closed" ? "default" : "outline"}
            >
              <LockIcon data-icon="inline-start" />
              Un lugar cerró
            </Button>
          </div>

          <div className="rounded-xl border bg-card p-3 text-sm">
            {scenario === "overstay"
              ? `Te quedaste más tiempo en ${itemName(currentItem)}.`
              : `${upcoming[0] ? itemName(upcoming[0]) : "El próximo punto"} no está disponible.`}
          </div>

          <div className="grid gap-2">
            <ReplanOption
              active={strategy === "trim"}
              description="Mantené todos los puntos, con tiempos 30% más cortos."
              icon={ScissorsIcon}
              onClick={() => setStrategy("trim")}
              title="Recortar tiempos"
            />
            {strategy === "trim" ? (
              <div className="grid gap-2 rounded-xl border bg-card p-3">
                <p className="text-sm text-muted-foreground">
                  {preview?.strategy === "trim"
                    ? preview.explanation
                    : "Calculando recorte…"}
                </p>
                {preview?.strategy === "trim"
                  ? preview.operations.map((operation) => (
                      <span
                        className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"
                        key={operation.id}
                      >
                        {operation.label}
                        {operation.previousDurationMinutes &&
                        operation.durationMinutes ? (
                          <>
                            {" · "}
                            <span className="line-through opacity-50">
                              {formatDuration(operation.previousDurationMinutes)}
                            </span>{" "}
                            →{" "}
                            <strong>
                              {formatDuration(operation.durationMinutes)}
                            </strong>
                          </>
                        ) : null}
                      </span>
                    ))
                  : null}
              </div>
            ) : null}

            <ReplanOption
              active={strategy === "recalculate"}
              description="Quitá el último punto pendiente y recuperá margen."
              icon={RefreshCwIcon}
              onClick={() => setStrategy("recalculate")}
              title="Recalcular itinerario"
            />
            {strategy === "recalculate" ? (
              <div className="grid gap-2 rounded-xl border bg-card p-3">
                <p className="text-sm text-muted-foreground">
                  {preview?.strategy === "recalculate"
                    ? preview.explanation
                    : "Calculando alternativa…"}
                </p>
                {preview?.strategy === "recalculate"
                  ? preview.operations.map((operation) => (
                      <span
                        className="rounded-lg bg-muted/60 px-2.5 py-1.5 text-xs"
                        key={operation.id}
                      >
                        {operation.label}
                      </span>
                    ))
                  : null}
              </div>
            ) : null}

            <ReplanOption
              active={strategy === "recommended"}
              description="Aplicá una propuesta preparada para este imprevisto."
              icon={SparklesIcon}
              onClick={() => setStrategy("recommended")}
              title="Cambio recomendado"
            />
            {strategy === "recommended" ? (
              <div className="grid gap-2 rounded-xl border bg-card p-3">
                <p className="text-sm text-muted-foreground">
                  {preview?.explanation ?? "Preparando recomendación…"}
                </p>
                {preview?.operations.map((operation) => (
                  <label
                    className="flex cursor-pointer items-center gap-3 rounded-lg bg-muted/60 p-2.5 text-sm"
                    key={operation.id}
                  >
                    <input
                      checked={operation.enabled}
                      className="size-4 accent-primary"
                      onChange={() => toggleOperation(operation.id)}
                      type="checkbox"
                    />
                    <span>
                      {operation.label}
                      {operation.type === "trim" &&
                      operation.previousDurationMinutes &&
                      operation.durationMinutes
                        ? ` · ${formatDuration(operation.previousDurationMinutes)} → ${formatDuration(operation.durationMinutes)}`
                        : ""}
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
          </div>

          {error ? (
            <p className="text-sm font-medium text-destructive">{error}</p>
          ) : null}
        </div>

        <SheetFooter className="px-5">
          <Button
            className="h-12 w-full"
            disabled={
              pending ||
              (strategy === "recommended" &&
                !(preview?.operations.some((operation) => operation.enabled)))
            }
            onClick={applyChanges}
            size="lg"
          >
            {pending ? "Aplicando…" : "Aplicar cambios"}
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CompletedTravel({ trip }: { trip: TripDto }) {
  const router = useRouter();

  return (
    <div className="grid min-h-screen place-items-center bg-background px-5">
      <div className="max-w-sm text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg">
          <CheckCircle2Icon className="size-10" />
        </span>
        <h1 className="mt-6 text-3xl font-semibold">
          Viaje completado
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Llegaste al final de {trip.title}. El itinerario queda guardado para
          volver a consultarlo.
        </p>
        <Button
          className="mt-6"
          onClick={() => router.push(`/app/trips/${trip.id}`)}
          size="lg"
        >
          Ver resumen del viaje
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </div>
    </div>
  );
}

export function TravelMode({ trip }: { trip: TripDto }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noSelect = useCallback(() => {}, []);

  const allPoints = useMemo(
    () =>
      trip.days.flatMap((day) =>
        navigableItems(day).map((item) => ({
          dayNumber: day.dayNumber,
          item,
        })),
      ),
    [trip.days],
  );
  const currentIndex = allPoints.findIndex(
    ({ item }) => item.id === trip.currentItineraryItemId,
  );
  const currentPoint = allPoints[currentIndex];
  const upcoming = allPoints.slice(currentIndex + 1);
  const currentDay = trip.days.find(
    (day) => day.dayNumber === trip.currentDayNumber,
  );

  if (!trip.isOwner || trip.travelStatus === "planned") {
    return <StartTravelSheet trip={trip} />;
  }

  if (trip.travelStatus === "completed") {
    return <CompletedTravel trip={trip} />;
  }

  if (!currentPoint || !currentDay) {
    return (
      <div className="grid min-h-screen place-items-center px-5 text-center">
        <div>
          <h1 className="text-2xl font-semibold">
            No encontramos el punto actual
          </h1>
          <Button
            className="mt-4"
            onClick={() => router.push(`/app/trips/${trip.id}/itinerary`)}
          >
            Volver al itinerario
          </Button>
        </div>
      </div>
    );
  }

  async function advance() {
    setPending(true);
    setError(null);

    try {
      await readJson(
        await fetch(`/api/trips/${trip.id}/travel/advance`, {
          method: "POST",
        }),
      );
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo avanzar");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-background pb-28"
      data-travel-mode-view
    >
      <div className="relative h-72">
        <GoogleTripMap
          heightClassName="h-72"
          items={currentDay.items}
          onSelect={noSelect}
          selectedItemId={currentPoint.item.id}
          showAllControl={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/5 via-transparent to-background" />
        <div className="absolute inset-x-4 top-4 flex items-center justify-between">
          <Button
            aria-label="Volver al itinerario"
            className="size-10 rounded-full bg-white/90 shadow-md backdrop-blur"
            onClick={() =>
              router.push(
                `/app/trips/${trip.id}/itinerary/${currentPoint.dayNumber}`,
              )
            }
            size="icon"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-5" />
          </Button>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-border bg-card/95 px-4 text-xs font-semibold shadow-md backdrop-blur">
            <span className="size-2 rounded-full bg-success-foreground motion-safe:animate-pulse" />
            Modo viaje · Día {currentPoint.dayNumber}
          </div>
          <span className="size-10" />
        </div>
      </div>

      <main className="relative z-10 mx-auto -mt-12 grid w-full max-w-2xl gap-5 px-4">
        <section className="rounded-[1.75rem] border bg-card p-4 shadow-lg">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-primary">
              <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />
              Estás acá
            </p>
            <span className="text-xs text-muted-foreground">
              Punto {currentIndex + 1} de {allPoints.length}
            </span>
          </div>
          <div className="flex gap-4">
            <PlaceArt
              className="size-24 shrink-0 rounded-2xl"
              seed={currentPoint.item.place?.id ?? currentPoint.item.id}
            />
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold leading-tight">
                {itemName(currentPoint.item)}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentPoint.item.description ??
                  currentPoint.item.place?.description ??
                  "Seguí este punto de tu itinerario."}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
                <Clock3Icon className="size-3.5" />
                Hasta las {currentPoint.item.endTime} ·{" "}
                {formatDuration(currentPoint.item.durationMinutes)}
              </span>
            </div>
          </div>
        </section>

        {upcoming.length ? (
          <section>
            <p className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-muted-foreground">
              <MapPinIcon className="size-4" />
              A continuación
            </p>
            <div className="grid gap-2">
              {upcoming.slice(0, 4).map(({ dayNumber, item }, index) => (
                <div
                  className={cn(
                    "flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm",
                    index > 0 && "opacity-70",
                  )}
                  key={item.id}
                >
                  <time className="w-12 shrink-0 text-center text-xs font-bold tabular-nums">
                    {item.startTime}
                  </time>
                  <PlaceArt
                    className="size-12 shrink-0 rounded-xl"
                    seed={item.place?.id ?? item.id}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {itemName(item)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Día {dayNumber} · {formatDuration(item.durationMinutes)}
                    </p>
                  </div>
                  {index === 0 ? (
                    <ArrowRightIcon className="size-4 text-primary" />
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {error ? (
          <p className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 bg-linear-to-t from-background via-background to-transparent px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Button
            className="h-12"
            disabled={pending}
            onClick={() => setSheetOpen(true)}
            size="lg"
            variant="outline"
          >
            <RefreshCwIcon data-icon="inline-start" />
            Algo cambió
          </Button>
          <Button
            className="h-12 flex-1"
            disabled={pending}
            onClick={advance}
            size="lg"
          >
            {pending ? "Avanzando…" : "Siguiente punto"}
            <CheckCircle2Icon data-icon="inline-end" />
          </Button>
        </div>
      </div>

      <ReplanSheet
        currentItem={currentPoint.item}
        onApplied={() => router.refresh()}
        open={sheetOpen}
        setOpen={setSheetOpen}
        trip={trip}
        upcoming={upcoming
          .filter((point) => point.dayNumber === currentPoint.dayNumber)
          .map((point) => point.item)}
      />
    </div>
  );
}
