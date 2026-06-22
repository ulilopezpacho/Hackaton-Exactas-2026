"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  ClockIcon,
  LoaderCircleIcon,
  PlusIcon,
  SearchIcon,
  SparklesIcon,
  Trash2Icon,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PLACE_PRIORITY,
  PLACE_PRIORITY_OPTIONS,
  type PlacePriority,
} from "@/lib/places/priority";

import { saveTripGenerationContext } from "../actions";

type TripSummary = {
  endsOn: string;
  id: string;
  startsOn: string;
  title: string;
};

type PlaceSuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  text: string;
};

type PlaceDraft = {
  address: string | null;
  category: string | null;
  durationMinutes: number;
  latitude: number | null;
  longitude: number | null;
  name: string;
  placeId?: string;
  priority: PlacePriority;
  score?: number;
};

const AI_BATCH_SIZE = 5;

const DEFAULT_DURATION_MINUTES = 90;

// Visit-duration presets (minutes) the user can pick per activity. The chosen
// value is persisted as `default_duration_minutes` and used directly by the
// solver to schedule the day.
const DURATION_PRESETS = [30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 480];

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

export function TripPlacesForm({
  initialNotes = "",
  trip,
}: {
  initialNotes?: string;
  trip: TripSummary;
}) {
  const sessionToken = useRef(globalThis.crypto.randomUUID());
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [places, setPlaces] = useState<PlaceDraft[]>([]);
  const [notes, setNotes] = useState(initialNotes);
  const [message, setMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [aiCandidates, setAiCandidates] = useState<PlaceDraft[]>([]);
  const [aiAddedCount, setAiAddedCount] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const payload = useMemo(
    () =>
      JSON.stringify({
        endsOn: trip.endsOn,
        interests: [],
        notes,
        places,
        startsOn: trip.startsOn,
        title: trip.title,
        tripId: trip.id,
      }),
    [notes, places, trip],
  );

  useEffect(() => {
    const normalizedQuery = query.trim();

    if (normalizedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          q: normalizedQuery,
          sessionToken: sessionToken.current,
        });
        const response = await fetch(`/api/places/autocomplete?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          error?: string;
          suggestions?: PlaceSuggestion[];
        };

        if (!response.ok) {
          throw new Error(body.error ?? "No pudimos buscar lugares.");
        }

        setSuggestions(body.suggestions ?? []);
        setMessage(null);
      } catch (error) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setMessage(
            error instanceof Error
              ? `${error.message} Podés agregar el lugar manualmente.`
              : "Podés agregar el lugar manualmente.",
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  function updateQuery(nextQuery: string) {
    setQuery(nextQuery);

    if (nextQuery.trim().length < 2) {
      setSuggestions([]);
      setMessage(null);
      setIsSearching(false);
    }
  }

  async function addSuggestion(suggestion: PlaceSuggestion) {
    startTransition(async () => {
      try {
        const params = new URLSearchParams({
          placeId: suggestion.placeId,
          sessionToken: sessionToken.current,
        });
        const response = await fetch(`/api/places/details?${params}`);
        const body = (await response.json()) as {
          error?: string;
          place?: Omit<PlaceDraft, "durationMinutes"> & { placeId: string };
        };

        if (!response.ok || !body.place) {
          throw new Error(body.error ?? "No pudimos cargar el lugar.");
        }

        addPlace({
          ...body.place,
          durationMinutes: DEFAULT_DURATION_MINUTES,
        });
      } catch (error) {
        setMessage(
          error instanceof Error
            ? `${error.message} Lo agregué manualmente con el nombre sugerido.`
            : "Lo agregué manualmente con el nombre sugerido.",
        );
        addPlace({
          address: suggestion.secondaryText || null,
          category: null,
          durationMinutes: DEFAULT_DURATION_MINUTES,
          latitude: null,
          longitude: null,
          name: suggestion.primaryText,
        });
      }
    });
  }

  function addManualPlace() {
    const name = query.trim();

    if (!name) {
      return;
    }

    addPlace({
      address: null,
      category: null,
      durationMinutes: DEFAULT_DURATION_MINUTES,
      latitude: null,
      longitude: null,
      name,
    });
  }

  function addPlace(
    place: Omit<PlaceDraft, "priority"> & { priority?: PlacePriority },
  ) {
    setPlaces((current) => {
      if (place.placeId && current.some((item) => item.placeId === place.placeId)) {
        return current;
      }

      if (!place.placeId && current.some((item) => item.name === place.name)) {
        return current;
      }

      return [
        ...current,
        { ...place, priority: place.priority ?? DEFAULT_PLACE_PRIORITY },
      ];
    });
    setQuery("");
    setSuggestions([]);
  }

  function setPlacePriority(index: number, priority: PlacePriority) {
    setPlaces((current) =>
      current.map((place, placeIndex) =>
        placeIndex === index ? { ...place, priority } : place,
      ),
    );
  }

  function setPlaceDuration(index: number, durationMinutes: number) {
    setPlaces((current) =>
      current.map((place, placeIndex) =>
        placeIndex === index ? { ...place, durationMinutes } : place,
      ),
    );
  }

  function addAiBatch(candidates: PlaceDraft[], from: number) {
    const batch = candidates.slice(from, from + AI_BATCH_SIZE);

    setPlaces((current) => {
      const next = [...current];
      for (const place of batch) {
        const isDuplicate = place.placeId
          ? next.some((item) => item.placeId === place.placeId)
          : next.some((item) => item.name === place.name);
        if (!isDuplicate) {
          next.push(place);
        }
      }
      return next;
    });
    setAiAddedCount(from + batch.length);
  }

  async function generateAiPlaces() {
    setAiLoading(true);
    setAiError(null);

    try {
      const response = await fetch(`/api/trips/${trip.id}/suggest-places`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const body = (await response.json()) as {
        error?: string;
        places?: (Omit<PlaceDraft, "priority"> & { priority?: PlacePriority })[];
      };

      if (!response.ok || !body.places) {
        throw new Error(body.error ?? "No pudimos sugerir lugares con IA.");
      }

      if (body.places.length === 0) {
        setAiError(
          "La IA no encontró lugares para sugerir. Probá agregar una descripción del viaje.",
        );
        return;
      }

      const candidates: PlaceDraft[] = body.places.map((place) => ({
        ...place,
        priority: place.priority ?? DEFAULT_PLACE_PRIORITY,
      }));
      setAiCandidates(candidates);
      addAiBatch(candidates, 0);
    } catch (error) {
      setAiError(
        error instanceof Error
          ? error.message
          : "No pudimos sugerir lugares con IA.",
      );
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <form
      action={saveTripGenerationContext}
      className="grid gap-3 pb-24 md:gap-6 md:pb-28"
    >
      <input name="payload" type="hidden" value={payload} />

      <Card className="border-primary/10">
        <CardHeader className="gap-1 px-4 py-3 md:px-6 md:py-6">
          <Badge className="w-fit" variant="secondary">
            Prioridades del viaje
          </Badge>
          <CardTitle className="max-w-2xl text-2xl md:text-3xl">
            ¿Qué querés ver en {trip.title}?
          </CardTitle>
          <CardDescription className="max-w-2xl text-sm">
            Sumá lugares o preferencias opcionales para personalizar el viaje.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-primary/10">
        <CardHeader className="gap-1 px-4 py-3 md:px-6 md:py-6">
          <CardTitle className="text-lg md:text-xl">Agregar lugares opcionales</CardTitle>
          <CardDescription className="text-sm">
            Sumá referencias concretas que quieras priorizar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 px-4 pb-4 md:gap-4 md:px-6 md:pb-6">
          <div className="relative">
            <div className="flex h-13 items-center gap-3 rounded-[10px] border border-input bg-card px-4 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
              <SearchIcon className="size-4 text-muted-foreground" />
              <Input
                autoComplete="off"
                className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                onChange={(event) => updateQuery(event.target.value)}
                placeholder="Agregar un lugar opcional..."
                value={query}
              />
              {isSearching ? (
                <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
              ) : null}
              <Button
                disabled={!query.trim()}
                onClick={addManualPlace}
                size="sm"
                type="button"
                variant="secondary"
              >
                <PlusIcon data-icon="inline-start" />
                Manual
              </Button>
            </div>

            {suggestions.length > 0 ? (
              <div className="absolute left-0 right-0 top-15 z-10 overflow-hidden rounded-xl border bg-card shadow-xl">
                {suggestions.map((suggestion) => (
                  <button
                    className="flex w-full items-center gap-3 border-b px-3 py-3 text-left last:border-b-0 hover:bg-muted"
                    disabled={isPending}
                    key={suggestion.placeId}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      void addSuggestion(suggestion);
                    }}
                    type="button"
                  >
                    <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                      <MapPinGlyph />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">
                        {suggestion.primaryText}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {suggestion.secondaryText}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {message ? (
            <p className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
              {message}
            </p>
          ) : null}

          <div className="grid gap-2 border-t pt-3 md:pt-4">
            <p className="text-sm text-muted-foreground">
              ¿No sabés por dónde empezar? Dejá que la IA proponga lugares según
              tu descripción y tus gustos, y los cargue a tu lista de a {AI_BATCH_SIZE}.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                disabled={aiLoading}
                onClick={generateAiPlaces}
                type="button"
                variant="secondary"
              >
                {aiLoading ? (
                  <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                ) : (
                  <SparklesIcon data-icon="inline-start" />
                )}
                {aiLoading ? "Buscando lugares..." : "Agregar lugares con IA"}
              </Button>
              {aiCandidates.length > 0 && aiAddedCount < aiCandidates.length ? (
                <Button
                  disabled={aiLoading}
                  onClick={() => addAiBatch(aiCandidates, aiAddedCount)}
                  type="button"
                  variant="ghost"
                >
                  <PlusIcon data-icon="inline-start" />
                  Cargar {AI_BATCH_SIZE} más
                </Button>
              ) : null}
            </div>
            {aiError ? (
              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-foreground">
                {aiError}
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card className="border-primary/10">
        <CardHeader className="gap-1 px-4 py-3 md:px-6 md:py-6">
          <CardTitle className="text-lg md:text-xl">Personalizá el recorrido</CardTitle>
          <CardDescription className="text-sm">
            Agregá preferencias generales sin necesidad de elegir lugares.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 md:px-6 md:pb-6">
          <Textarea
            aria-label="Personalizá el recorrido"
            className="min-h-20 resize-none rounded-2xl bg-background px-4 py-3 shadow-sm md:min-h-24"
            id="trip-notes"
            maxLength={600}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Ej: queremos caminar poco, evitar museos largos, almorzar tarde y dejar tiempo libre para cafés."
            value={notes}
          />
        </CardContent>
      </Card>

      <section className="grid gap-2 md:gap-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">Lista de prioridades</Badge>
          <span className="text-xs text-muted-foreground">
            Elegí qué tan importante es cada lugar
          </span>
        </div>

        {places.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-4 py-4 text-center text-xs text-muted-foreground md:px-6 md:py-10 md:text-sm">
            No agregaste lugares, y está bien. El generador va a descubrirlos
            usando tu prompt y tus preferencias.
          </div>
        ) : (
          places.map((place, index) => (
            <Card key={`${place.placeId ?? place.name}-${index}`} size="sm">
              <CardContent className="grid gap-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-semibold">{place.name}</p>
                      {place.score != null ? (
                        <Badge className="shrink-0 gap-1" variant="secondary">
                          <SparklesIcon className="size-3" />
                          {place.score}
                        </Badge>
                      ) : null}
                    </div>
                    {place.address ? (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {place.address}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    aria-label={`Quitar ${place.name}`}
                    onClick={() =>
                      setPlaces((current) =>
                        current.filter((_, placeIndex) => placeIndex !== index),
                      )
                    }
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Trash2Icon />
                  </Button>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <ClockIcon className="size-3.5" />
                    Duración de la visita
                  </span>
                  <select
                    aria-label={`Duración de ${place.name}`}
                    className="h-8 rounded-[8px] border border-input bg-card px-2 text-sm font-medium focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    onChange={(event) =>
                      setPlaceDuration(index, Number(event.target.value))
                    }
                    value={place.durationMinutes}
                  >
                    {Array.from(
                      new Set([...DURATION_PRESETS, place.durationMinutes]),
                    )
                      .sort((a, b) => a - b)
                      .map((minutes) => (
                        <option key={minutes} value={minutes}>
                          {formatDuration(minutes)}
                        </option>
                      ))}
                  </select>
                </div>

                <div
                  className="grid grid-cols-3 gap-1 rounded-[10px] bg-muted p-1"
                  role="group"
                  aria-label={`Prioridad de ${place.name}`}
                >
                  {PLACE_PRIORITY_OPTIONS.map((option) => {
                    const selected = place.priority === option.value;
                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "rounded-[7px] px-1 py-1.5 text-xs font-medium transition-colors",
                          selected
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                        key={option.value}
                        onClick={() => setPlacePriority(index, option.value)}
                        type="button"
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-4 border-t bg-background/95 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur">
        <div className="min-w-24">
          <p className="text-xl font-semibold">
            {places.length} {places.length === 1 ? "lugar opcional" : "lugares opcionales"}
          </p>
          <p className="text-xs text-muted-foreground">
            {trip.startsOn} · {trip.endsOn}
          </p>
        </div>
        <Button
          className="h-12 flex-1"
          type="submit"
        >
          <SparklesIcon data-icon="inline-start" />
          Enviar al generador
        </Button>
      </div>
    </form>
  );
}

function MapPinGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 21s7-6.1 7-12a7 7 0 1 0-14 0c0 5.9 7 12 7 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 12.2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  );
}
