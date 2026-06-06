"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  GripVerticalIcon,
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
};

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
  const [isPending, startTransition] = useTransition();

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

  async function searchPlaces(nextQuery: string) {
    setQuery(nextQuery);

    if (nextQuery.trim().length < 2) {
      setSuggestions([]);
      setMessage(null);
      return;
    }

    try {
      const params = new URLSearchParams({
        q: nextQuery,
        sessionToken: sessionToken.current,
      });
      const response = await fetch(`/api/places/autocomplete?${params}`);
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
      setSuggestions([]);
      setMessage(
        error instanceof Error
          ? `${error.message} Podés agregar el lugar manualmente.`
          : "Podés agregar el lugar manualmente.",
      );
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
          durationMinutes: 90,
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
          durationMinutes: 90,
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
      durationMinutes: 90,
      latitude: null,
      longitude: null,
      name,
    });
  }

  function addPlace(place: PlaceDraft) {
    setPlaces((current) => {
      if (place.placeId && current.some((item) => item.placeId === place.placeId)) {
        return current;
      }

      if (!place.placeId && current.some((item) => item.name === place.name)) {
        return current;
      }

      return [...current, place];
    });
    setQuery("");
    setSuggestions([]);
  }

  function movePlace(index: number, direction: -1 | 1) {
    setPlaces((current) => {
      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [place] = next.splice(index, 1);
      next.splice(nextIndex, 0, place);
      return next;
    });
  }

  return (
    <form action={saveTripGenerationContext} className="grid gap-6">
      <input name="payload" type="hidden" value={payload} />

      <Card className="border-primary/10">
        <CardHeader>
          <Badge className="w-fit" variant="secondary">
            Prioridades del viaje
          </Badge>
          <CardTitle className="max-w-2xl text-3xl">
            ¿Qué querés ver en {trip.title}?
          </CardTitle>
          <CardDescription className="max-w-2xl">
            Sumá los lugares que te interesan y ordenalos según qué tan
            importantes son para este viaje.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="relative">
            <div className="flex h-13 items-center gap-3 rounded-full border border-border bg-background px-4 shadow-sm focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
              <SearchIcon className="size-4 text-muted-foreground" />
              <Input
                autoComplete="off"
                className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                onChange={(event) => void searchPlaces(event.target.value)}
                placeholder="Buscá o escribí un lugar..."
                value={query}
              />
              <Button
                className="rounded-full"
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
                    <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
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

          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="trip-notes">
              Personalizá el recorrido
            </label>
            <Textarea
              className="min-h-24 resize-none rounded-2xl bg-background px-4 py-3 shadow-sm"
              id="trip-notes"
              maxLength={600}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Ej: queremos caminar poco, evitar museos largos, almorzar tarde y dejar tiempo libre para cafés."
              value={notes}
            />
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <Badge variant="secondary">Lista de prioridades</Badge>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <GripVerticalIcon className="size-3" />
            Usá las flechas para reordenar
          </span>
        </div>

        {places.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">
            Tu lista está vacía. Buscá un lugar o agregalo manualmente.
          </div>
        ) : (
          places.map((place, index) => (
            <Card key={`${place.placeId ?? place.name}-${index}`} size="sm">
              <CardContent className="flex items-center gap-3">
                <Badge className="size-8 rounded-full p-0" variant="secondary">
                  {index + 1}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{place.name}</p>
                  {place.address ? (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {place.address}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    disabled={index === 0}
                    onClick={() => movePlace(index, -1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowUpIcon />
                  </Button>
                  <Button
                    disabled={index === places.length - 1}
                    onClick={() => movePlace(index, 1)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowDownIcon />
                  </Button>
                  <Button
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
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <div className="sticky bottom-0 -mx-5 flex items-center gap-4 border-t bg-background/85 px-5 py-4 backdrop-blur">
        <div className="min-w-24">
          <p className="font-heading text-xl font-semibold">
            {places.length} prioridades
          </p>
          <p className="text-xs text-muted-foreground">
            {trip.startsOn} · {trip.endsOn}
          </p>
        </div>
        <Button
          className="h-12 flex-1 rounded-full"
          disabled={places.length === 0}
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
