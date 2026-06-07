"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  CalendarDaysIcon,
  CheckIcon,
  LoaderCircleIcon,
  MapPinIcon,
  SearchIcon,
  SparklesIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import { createTripDraft } from "../actions";

type CitySuggestion = {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  text: string;
};

type TripDestinationFormProps = {
  error?: string;
};

type FloatingBox = {
  left: number;
  maxHeight: number;
  top: number;
  width: number;
};

type FloatingOptions = {
  preferredHeight?: number;
  preferredWidth?: number;
};

export function TripDestinationForm({ error }: TripDestinationFormProps) {
  const sessionToken = useRef(globalThis.crypto.randomUUID());
  const cityControlRef = useRef<HTMLDivElement | null>(null);
  const cityOverlayRef = useRef<HTMLDivElement | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySuggestion | null>(null);
  const [range, setRange] = useState<DateRange | undefined>();
  const [cityBox, setCityBox] = useState<FloatingBox | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const title = selectedCity?.primaryText ?? query.trim();
  const startsOn = range?.from ? formatInputDate(range.from) : "";
  const endsOn = range?.to ? formatInputDate(range.to) : "";
  const canContinue = Boolean(title && startsOn && endsOn);
  const dateLabel = useMemo(() => formatDateRange(range), [range]);

  useEffect(() => {
    if (query.trim().length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          sessionToken: sessionToken.current,
        });
        const response = await fetch(`/api/places/cities?${params}`, {
          signal: controller.signal,
        });
        const body = (await response.json()) as {
          error?: string;
          suggestions?: CitySuggestion[];
        };

        if (!response.ok) {
          throw new Error(body.error ?? "No pudimos buscar ciudades.");
        }

        setSuggestions(body.suggestions ?? []);
        setSearchError(null);
      } catch (searchError) {
        if (!controller.signal.aborted) {
          setSuggestions([]);
          setSearchError(
            searchError instanceof Error
              ? `${searchError.message} Podés seguir con el texto escrito.`
              : "Podés seguir con el texto escrito.",
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

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }

      if (
        showSuggestions &&
        !cityControlRef.current?.contains(event.target) &&
        !cityOverlayRef.current?.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);

    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [query, showSuggestions]);

  useEffect(() => {
    if (!showSuggestions) {
      return;
    }

    function updateFloatingBoxes() {
      if (showSuggestions && query.trim().length >= 2) {
        setCityBox(measureFloatingBox(cityControlRef.current));
      }
    }

    updateFloatingBoxes();
    window.addEventListener("resize", updateFloatingBoxes);
    window.addEventListener("scroll", updateFloatingBoxes, true);

    return () => {
      window.removeEventListener("resize", updateFloatingBoxes);
      window.removeEventListener("scroll", updateFloatingBoxes, true);
    };
  }, [query, showSuggestions]);

  function selectCity(city: CitySuggestion) {
    setSelectedCity(city);
    setQuery(city.primaryText);
    setShowSuggestions(false);
  }

  function updateQuery(value: string) {
    setQuery(value);
    setSelectedCity(null);

    if (value.trim().length < 2) {
      setShowSuggestions(false);
      setCityBox(null);
      setSuggestions([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }

    setShowSuggestions(true);
    setCityBox(measureFloatingBox(cityControlRef.current));
  }

  return (
    <form action={createTripDraft} className="grid gap-6">
      <input name="title" type="hidden" value={title} />
      <input name="startsOn" type="hidden" value={startsOn} />
      <input name="endsOn" type="hidden" value={endsOn} />

      <div className="grid gap-5 lg:grid-cols-[1fr_1.05fr]">
        <Card className="relative min-h-80 overflow-hidden border-primary/20 bg-primary text-primary-foreground">
          <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(118deg,transparent_0_28%,rgba(255,255,255,.2)_28%_29%,transparent_29%_58%,rgba(255,255,255,.15)_58%_59%,transparent_59%),linear-gradient(28deg,transparent_0_45%,rgba(255,255,255,.14)_45%_46%,transparent_46%)]" />
          <CardHeader className="relative">
            <Badge className="w-fit bg-primary-foreground/12 text-primary-foreground" variant="secondary">
              <SparklesIcon data-icon="inline-start" />
              Rumbo
            </Badge>
            <CardTitle className="mt-8 max-w-sm text-4xl leading-tight">
              Decinos dónde vas. Armamos el camino.
            </CardTitle>
            <CardDescription className="max-w-sm text-base text-primary-foreground/70">
              Buscá una ciudad y elegí el rango del viaje.
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <MapPinIcon className="size-4" />
                ¿A dónde vas?
              </CardTitle>
              <CardDescription>
                Escribí una ciudad y seleccioná una coincidencia.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div ref={cityControlRef}>
                <div className="flex h-13 items-center gap-3 rounded-[10px] border border-input bg-card px-4 focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/20">
                  <SearchIcon className="size-4 text-muted-foreground" />
                  <Input
                    autoComplete="off"
                    className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                    placeholder="Buscá una ciudad..."
                    value={query}
                    onChange={(event) => updateQuery(event.target.value)}
                    onFocus={() => {
                      if (query.trim().length >= 2) {
                        setShowSuggestions(true);
                        window.requestAnimationFrame(() => {
                          setCityBox(measureFloatingBox(cityControlRef.current));
                        });
                      }
                    }}
                  />
                  {selectedCity ? (
                    <Badge variant="secondary">
                      Seleccionada
                    </Badge>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {isSearching ? <LoaderCircleIcon className="size-4 animate-spin" /> : null}
                <span>
                  {selectedCity
                    ? "Ciudad seleccionada."
                    : "También podés continuar con el texto escrito."}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="inline-flex items-center gap-2">
                <CalendarDaysIcon className="size-4" />
                ¿Cuándo?
              </CardTitle>
              <CardDescription>
                Elegí llegada y salida en un calendario de rango.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Popover
                open={dateOpen}
                onOpenChange={(open) => {
                  if (open) {
                    setDateOpen(true);
                  }
                }}
              >
                <PopoverTrigger
                  render={
                  <Button
                    aria-expanded={dateOpen}
                    className={cn(
                      "h-12 w-full justify-start border-border bg-card px-4 text-left font-normal",
                      !range?.from && "text-muted-foreground",
                    )}
                    type="button"
                    variant="outline"
                  />
                  }
                >
                  <CalendarDaysIcon data-icon="inline-start" />
                  {dateLabel}
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-auto rounded-2xl p-3 shadow-2xl"
                  side="top"
                  sideOffset={10}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 px-1">
                    <p className="text-sm font-semibold">Rango de fechas</p>
                    {range?.from ? (
                      <Button
                        size="sm"
                        type="button"
                        variant="ghost"
                        onClick={() => setRange(undefined)}
                      >
                        Limpiar
                      </Button>
                    ) : null}
                  </div>
                  <Calendar
                    mode="range"
                    locale={es}
                    numberOfMonths={1}
                    selected={range}
                    disabled={{ before: startOfToday() }}
                    onSelect={(nextRange) => {
                      setRange(nextRange);
                      if (
                        nextRange?.from &&
                        nextRange.to &&
                        nextRange.from.getTime() !== nextRange.to.getTime()
                      ) {
                        setDateOpen(false);
                      }
                    }}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Revisá destino y fechas. No pudimos guardar este paso.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button
          className="px-6"
          disabled={!canContinue}
          type="submit"
        >
          Continuar
        </Button>
      </div>

      {typeof document !== "undefined" &&
      showSuggestions &&
      query.trim().length >= 2 &&
      cityBox
        ? createPortal(
            <div
              className="overflow-y-auto rounded-xl border bg-card shadow-xl shadow-foreground/10"
              ref={cityOverlayRef}
              style={{
                left: cityBox.left,
                maxHeight: cityBox.maxHeight,
                position: "fixed",
                top: cityBox.top,
                width: cityBox.width,
                zIndex: 9999,
              }}
            >
              {searchError ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  {searchError}
                </p>
              ) : null}
              {query.trim().length >= 2 && isSearching ? (
                <p className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  Buscando ciudades...
                </p>
              ) : null}
              {query.trim().length >= 2 &&
              !isSearching &&
              !searchError &&
              suggestions.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No encontramos esa ciudad.
                </p>
              ) : null}
              {suggestions.map((city) => (
                <button
                  className="flex w-full items-center gap-3 border-b px-3 py-3 text-left text-sm transition last:border-b-0 hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  key={city.placeId}
                  type="button"
                  onClick={() => selectCity(city)}
                >
                  <span className="flex size-9 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                    <MapPinIcon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {city.primaryText}
                    </span>
                    {city.secondaryText ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {city.secondaryText}
                      </span>
                    ) : null}
                  </span>
                  {selectedCity?.placeId === city.placeId ? (
                    <CheckIcon className="size-4" />
                  ) : null}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}

    </form>
  );
}

function measureFloatingBox(
  element: HTMLElement | null,
  options: FloatingOptions = {},
): FloatingBox | null {
  if (!element) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  const margin = 16;
  const width = Math.min(
    options.preferredWidth ?? rect.width,
    window.innerWidth - margin * 2,
  );
  const left = Math.min(
    Math.max(rect.left, margin),
    window.innerWidth - width - margin,
  );
  const preferredHeight = options.preferredHeight ?? 320;
  const belowTop = rect.bottom + 8;
  const belowSpace = window.innerHeight - belowTop - margin;
  const aboveSpace = rect.top - margin - 8;
  const opensAbove = belowSpace < preferredHeight && aboveSpace > belowSpace;
  const top = opensAbove
    ? Math.max(margin, rect.top - preferredHeight - 8)
    : belowTop;
  const availableHeight = opensAbove ? aboveSpace : belowSpace;
  const maxHeight = Math.max(180, Math.min(preferredHeight, availableHeight));

  return { left, maxHeight, top, width };
}

function formatInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateRange(range: DateRange | undefined) {
  if (!range?.from) {
    return "Elegir fechas";
  }

  if (!range.to) {
    return `Salida desde ${formatDisplayDate(range.from)}`;
  }

  return `${formatDisplayDate(range.from)} - ${formatDisplayDate(range.to)}`;
}

function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  })
    .format(date)
    .replace(".", "");
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return today;
}
