"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  MapIcon,
  NavigationIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Share2Icon,
  SparklesIcon,
  StarIcon,
  XIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Screen = "home" | "create" | "activities" | "generate" | "itinerary" | "travel";
type PlaceTag = "Historia" | "Arte" | "Aire libre" | "Clásico" | "Gastro" | "Vistas" | "Paseo" | "Fútbol";
type PlaceId =
  | "palacio"
  | "prado"
  | "retiro"
  | "mayor"
  | "sanmiguel"
  | "reina"
  | "debod"
  | "granvia"
  | "letras"
  | "bernabeu";

type Place = {
  id: PlaceId;
  name: string;
  tag: PlaceTag;
  duration: number;
  note: string;
};

type WishlistItem = {
  id: PlaceId;
  duration: number;
};

type DateRange = {
  start: number | null;
  end: number | null;
};

type ItineraryStop = {
  type: "stop";
  id: PlaceId;
  start: string;
  end: string;
  meal?: string;
};

type ItineraryMove = {
  type: "move";
  mode: "walk" | "metro";
  mins: number;
  text?: string;
};

type ItineraryGap = {
  type: "gap";
  from: string;
  kind: string;
  title: string;
  note: string;
};

type ItineraryItem = ItineraryStop | ItineraryMove | ItineraryGap;

type ItineraryDay = {
  dayNumber: number;
  version: string;
  label: string;
  date: string;
  sub: string;
  items: ItineraryItem[];
};

const places: Place[] = [
  { id: "palacio", name: "Palacio Real", tag: "Historia", duration: 2, note: "El palacio más grande de Europa occidental" },
  { id: "prado", name: "Museo del Prado", tag: "Arte", duration: 3, note: "Velázquez, Goya y El Bosco" },
  { id: "retiro", name: "Parque del Retiro", tag: "Aire libre", duration: 1.5, note: "El jardín en el corazón de Madrid" },
  { id: "mayor", name: "Plaza Mayor", tag: "Clásico", duration: 1, note: "Plaza porticada del s. XVII" },
  { id: "sanmiguel", name: "Mercado de San Miguel", tag: "Gastro", duration: 1, note: "Tapas bajo estructura de hierro" },
  { id: "reina", name: "Museo Reina Sofía", tag: "Arte", duration: 2, note: "El Guernica de Picasso" },
  { id: "debod", name: "Templo de Debod", tag: "Vistas", duration: 1, note: "Templo egipcio y atardeceres" },
  { id: "granvia", name: "Gran Vía", tag: "Paseo", duration: 1, note: "La avenida que nunca duerme" },
  { id: "letras", name: "Barrio de las Letras", tag: "Paseo", duration: 1.5, note: "Calles de Cervantes y Lope de Vega" },
  { id: "bernabeu", name: "Estadio Bernabéu", tag: "Fútbol", duration: 2, note: "Tour por el estadio del Real Madrid" },
];

const destinations = [
  { id: "madrid", name: "Madrid", country: "España" },
  { id: "lisboa", name: "Lisboa", country: "Portugal" },
  { id: "roma", name: "Roma", country: "Italia" },
  { id: "paris", name: "París", country: "Francia" },
  { id: "cdmx", name: "CDMX", country: "México" },
  { id: "tokio", name: "Tokio", country: "Japón" },
];

const interestTags: PlaceTag[] = ["Arte", "Historia", "Gastro", "Aire libre", "Vistas", "Paseo", "Clásico", "Fútbol"];
const suggestionIds: PlaceId[] = ["reina", "debod", "granvia", "letras"];
const durationCycle = [1, 1.5, 2, 3];

const itinerary: ItineraryDay[] = [
  {
    dayNumber: 1,
    version: "Versión equilibrada",
    label: "Día 1",
    date: "jue 12 jun",
    sub: "Madrid de los Austrias",
    items: [
      { type: "stop", id: "palacio", start: "10:00", end: "12:00" },
      { type: "move", mode: "walk", mins: 8, text: "Plaza de Oriente" },
      { type: "stop", id: "mayor", start: "12:10", end: "13:10" },
      { type: "move", mode: "walk", mins: 4 },
      { type: "stop", id: "sanmiguel", start: "13:15", end: "14:15", meal: "Almuerzo" },
      { type: "move", mode: "walk", mins: 18, text: "Paseo del Prado" },
      { type: "stop", id: "prado", start: "15:00", end: "18:00" },
      { type: "move", mode: "walk", mins: 6 },
      { type: "stop", id: "retiro", start: "18:10", end: "19:40" },
      {
        type: "gap",
        from: "20:00",
        kind: "Espectáculo",
        title: "Tablao flamenco en Cardamomo",
        note: "Tenés la noche libre. Quedan 2 entradas para la sesión de las 21:00.",
      },
    ],
  },
  {
    dayNumber: 2,
    version: "Versión arte",
    label: "Día 2",
    date: "vie 13 jun",
    sub: "Arte y atardecer",
    items: [
      { type: "stop", id: "reina", start: "10:30", end: "12:30" },
      { type: "move", mode: "walk", mins: 12 },
      { type: "stop", id: "letras", start: "12:45", end: "14:15", meal: "Comida de tapas" },
      { type: "move", mode: "metro", mins: 15 },
      { type: "stop", id: "debod", start: "17:30", end: "18:30" },
      {
        type: "gap",
        from: "19:00",
        kind: "Mirador",
        title: "Rooftop del Círculo de Bellas Artes",
        note: "Hueco antes de la cena: el mejor atardecer de Madrid a 10 min.",
      },
      { type: "move", mode: "walk", mins: 10 },
      { type: "stop", id: "granvia", start: "20:00", end: "21:00" },
    ],
  },
  {
    dayNumber: 3,
    version: "Versión express",
    label: "Día 3",
    date: "sáb 14 jun",
    sub: "Antes del vuelo",
    items: [
      { type: "stop", id: "bernabeu", start: "11:00", end: "13:00" },
      { type: "move", mode: "metro", mins: 20 },
      {
        type: "gap",
        from: "13:30",
        kind: "Gastro",
        title: "Vermut en el Mercado de la Cebada",
        note: "Te queda media tarde libre antes de salir al aeropuerto.",
      },
    ],
  },
];

const mapStops = [
  { n: 1, id: "palacio" as PlaceId, x: 70, y: 150, time: "10:00" },
  { n: 2, id: "mayor" as PlaceId, x: 138, y: 205, time: "12:10" },
  { n: 3, id: "sanmiguel" as PlaceId, x: 120, y: 250, time: "13:15" },
  { n: 4, id: "prado" as PlaceId, x: 268, y: 232, time: "15:00" },
  { n: 5, id: "retiro" as PlaceId, x: 300, y: 300, time: "18:10" },
];

const defaultWishlist: WishlistItem[] = ["palacio", "prado", "mayor", "sanmiguel", "retiro"].map((id) => ({
  id: id as PlaceId,
  duration: placeById(id as PlaceId).duration,
}));

function placeById(id: PlaceId) {
  const place = places.find((item) => item.id === id);
  if (!place) {
    throw new Error(`Unknown place: ${id}`);
  }
  return place;
}

function formatDuration(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (Number.isInteger(hours)) return `${hours} h`;

  const whole = Math.floor(hours);
  return `${whole} h ${Math.round((hours - whole) * 60)}`;
}

function trimDuration(hours: number) {
  return Math.max(0.5, Math.round(hours * 0.7 * 2) / 2);
}

export default function Page() {
  const [stack, setStack] = useState<Screen[]>(["home"]);
  const [destinationId, setDestinationId] = useState("madrid");
  const [dates, setDates] = useState<DateRange>({ start: 12, end: 14 });
  const [wishlist, setWishlist] = useState<WishlistItem[]>(defaultWishlist);

  const screen = stack.at(-1) ?? "home";
  const destination = destinations.find((item) => item.id === destinationId) ?? destinations[0];
  const days = dates.start && dates.end ? dates.end - dates.start + 1 : 3;

  const go = (next: Screen, replace = false) => {
    setStack((current) => (replace ? [...current.slice(0, -1), next] : [...current, next]));
  };
  const back = () => setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));

  const addPlace = (id: PlaceId) => {
    setWishlist((current) => (current.some((item) => item.id === id) ? current : [...current, { id, duration: placeById(id).duration }]));
  };
  const removePlace = (id: PlaceId) => setWishlist((current) => current.filter((item) => item.id !== id));
  const cycleDuration = (id: PlaceId) => {
    setWishlist((current) =>
      current.map((item) => {
        if (item.id !== id) return item;
        const index = durationCycle.indexOf(item.duration);
        return { ...item, duration: durationCycle[(index + 1) % durationCycle.length] };
      }),
    );
  };
  const movePlace = (id: PlaceId, direction: -1 | 1) => {
    setWishlist((current) => {
      const index = current.findIndex((item) => item.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;

      const copy = [...current];
      const [item] = copy.splice(index, 1);
      copy.splice(nextIndex, 0, item);
      return copy;
    });
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="min-h-screen bg-background">
        {screen === "home" && <HomeScreen go={go} />}
        {screen === "create" && (
          <CreateScreen
            back={back}
            dates={dates}
            destination={destination}
            destinationId={destinationId}
            go={go}
            setDates={setDates}
            setDestinationId={setDestinationId}
          />
        )}
        {screen === "activities" && (
          <ActivitiesScreen
            addPlace={addPlace}
            back={back}
            cycleDuration={cycleDuration}
            days={days}
            go={go}
            movePlace={movePlace}
            removePlace={removePlace}
            setWishlist={setWishlist}
            wishlist={wishlist}
          />
        )}
        {screen === "generate" && <GenerateScreen go={go} wishlistSize={wishlist.length} />}
        {screen === "itinerary" && <ItineraryScreen back={back} go={go} />}
        {screen === "travel" && <TravelScreen back={back} />}
      </section>
    </main>
  );
}

function HomeScreen({ go }: { go: (next: Screen) => void }) {
  return (
    <ScreenShell>
      <Header
        large
        right={<div className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">U</div>}
        subtitle="Buen día, Uli"
        title="Mis viajes"
      />
      <ScrollContent>
        <button className="group text-left" onClick={() => go("create")} type="button">
          <Card className="border-0 bg-primary p-0 text-primary-foreground shadow-xl">
            <Photo className="min-h-56 justify-end rounded-xl p-5" seed="hero">
              <div className="flex flex-col items-start gap-4">
                <Badge variant="secondary" className="bg-background/90 text-foreground">
                  <SparklesIcon data-icon="inline-start" />
                  Nuevo
                </Badge>
                <h2 className="max-w-72 text-3xl font-semibold leading-tight tracking-tight">
                  Decinos qué querés ver. Armamos el viaje.
                </h2>
                <span className="inline-flex h-11 items-center gap-2 rounded-full bg-background px-5 text-sm font-semibold text-foreground">
                  <PlusIcon />
                  Crear un viaje
                </span>
              </div>
            </Photo>
          </Card>
        </button>

        <SectionRow action="1 borrador">Tus viajes</SectionRow>

        <button className="text-left" onClick={() => go("activities")} type="button">
          <Card>
            <CardContent className="flex gap-3">
              <Photo className="size-20 shrink-0 rounded-lg" seed="madrid" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-semibold tracking-tight">Madrid</h3>
                  <Badge variant="secondary">Borrador</Badge>
                </div>
                <p className="text-sm text-muted-foreground">12 - 14 jun · 5 lugares</p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                  Seguir armando <ArrowRightIcon />
                </p>
              </div>
            </CardContent>
          </Card>
        </button>

        <Card className="opacity-80">
          <CardContent className="flex gap-3">
            <Photo className="size-20 shrink-0 rounded-lg" seed="lisboa" />
            <div>
              <h3 className="text-xl font-semibold tracking-tight">Lisboa</h3>
              <p className="text-sm text-muted-foreground">mar 2026 · 4 días</p>
              <p className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
                <CheckIcon /> Completado
              </p>
            </div>
          </CardContent>
        </Card>
      </ScrollContent>
    </ScreenShell>
  );
}

function CreateScreen({
  back,
  dates,
  destination,
  destinationId,
  go,
  setDates,
  setDestinationId,
}: {
  back: () => void;
  dates: DateRange;
  destination: { id: string; name: string; country: string };
  destinationId: string;
  go: (next: Screen) => void;
  setDates: (dates: DateRange) => void;
  setDestinationId: (id: string) => void;
}) {
  const ready = dates.start !== null && dates.end !== null;
  const days = ready ? (dates.end ?? 0) - (dates.start ?? 0) + 1 : 0;

  const pickDate = (day: number) => {
    if (!dates.start || dates.end || day < dates.start) {
      setDates({ start: day, end: null });
      return;
    }

    setDates({ start: dates.start, end: day });
  };

  return (
    <ScreenShell>
      <Header back={back} title="Nuevo viaje" />
      <ScrollContent>
        <h1 className="text-3xl font-semibold tracking-tight">Empecemos por lo básico</h1>

        <Kicker>
          <NavigationIcon data-icon="inline-start" />
          ¿A dónde vas?
        </Kicker>
        <Card className="p-0">
          <Photo className="min-h-32 justify-end rounded-xl p-4" seed={destination.id}>
            <div className="text-background">
              <h2 className="text-2xl font-semibold">{destination.name}</h2>
              <p className="text-sm font-medium opacity-90">{destination.country}</p>
            </div>
          </Photo>
        </Card>
        <div className="flex flex-wrap gap-2">
          {destinations.map((item) => (
            <Button
              key={item.id}
              onClick={() => setDestinationId(item.id)}
              size="sm"
              type="button"
              variant={item.id === destinationId ? "default" : "outline"}
            >
              {item.name}
            </Button>
          ))}
        </div>

        <div className="h-px bg-border" />

        <Kicker>
          <CalendarDaysIcon data-icon="inline-start" />
          ¿Cuándo?
        </Kicker>
        <Calendar dates={dates} onPick={pickDate} />
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <ClockIcon />
          {ready ? (
            <span className="text-foreground">
              {dates.start} - {dates.end} jun · <strong>{days} días</strong>
            </span>
          ) : (
            "Elegí la fecha de llegada y de salida"
          )}
        </p>
      </ScrollContent>
      <BottomBar>
        <Button className="h-12 w-full rounded-full" disabled={!ready} onClick={() => go("activities")} type="button">
          Continuar
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </BottomBar>
    </ScreenShell>
  );
}

function Calendar({ dates, onPick }: { dates: DateRange; onPick: (day: number) => void }) {
  const cells = useMemo(() => {
    const result: (number | null)[] = [];
    const lead = (new Date(2026, 5, 1).getDay() + 6) % 7;

    for (let index = 0; index < lead; index += 1) result.push(null);
    for (let day = 1; day <= 30; day += 1) result.push(day);

    return result;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Junio 2026</CardTitle>
        <CardAction className="text-muted-foreground">‹ ›</CardAction>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["L", "M", "X", "J", "V", "S", "D"].map((day) => (
            <span className="pb-1 text-xs font-semibold text-muted-foreground" key={day}>
              {day}
            </span>
          ))}
          {cells.map((day, index) => {
            if (!day) return <span key={index} />;

            const selected = day === dates.start || day === dates.end;
            const inRange = dates.start && dates.end && day > dates.start && day < dates.end;

            return (
              <button
                className={cn(
                  "flex h-10 items-center justify-center rounded-full text-sm font-medium",
                  selected && "bg-primary text-primary-foreground",
                  inRange && "bg-primary/10 text-primary",
                )}
                key={index}
                onClick={() => onPick(day)}
                type="button"
              >
                {day}
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivitiesScreen({
  addPlace,
  back,
  cycleDuration,
  days,
  go,
  movePlace,
  removePlace,
  setWishlist,
  wishlist,
}: {
  addPlace: (id: PlaceId) => void;
  back: () => void;
  cycleDuration: (id: PlaceId) => void;
  days: number;
  go: (next: Screen) => void;
  movePlace: (id: PlaceId, direction: -1 | 1) => void;
  removePlace: (id: PlaceId) => void;
  setWishlist: (items: WishlistItem[]) => void;
  wishlist: WishlistItem[];
}) {
  const [query, setQuery] = useState("");
  const [preferences, setPreferences] = useState<PlaceTag[]>(["Arte", "Historia"]);
  const [showPreferences, setShowPreferences] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const chosenIds = new Set(wishlist.map((item) => item.id));
  const searchResults = query.trim()
    ? places.filter((place) => !chosenIds.has(place.id) && place.name.toLowerCase().includes(query.trim().toLowerCase()))
    : [];
  const visibleSuggestions = suggestionIds.filter((id) => !chosenIds.has(id));

  const togglePreference = (tag: PlaceTag) => {
    setPreferences((current) => (current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]));
  };
  const orderWithAi = () => {
    const sorted = [...wishlist].sort((a, b) => {
      const aRank = preferences.indexOf(placeById(a.id).tag);
      const bRank = preferences.indexOf(placeById(b.id).tag);
      return (aRank === -1 ? 99 : aRank) - (bRank === -1 ? 99 : bRank) || b.duration - a.duration;
    });

    setWishlist(sorted);
    setAiNote(`Ordenado según tus gustos: ${preferences.slice(0, 2).join(" y ").toLowerCase()} primero.`);
  };

  return (
    <ScreenShell>
      <Header back={back} right={<Badge variant="secondary">{days} días</Badge>} title="Madrid" />
      <ScrollContent>
        <Kicker>Tu lista de deseos</Kicker>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">¿Qué querés ver en Madrid?</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sumá los lugares que no te querés perder y ponelos en orden. La IA puede armarlo por vos.</p>
        </div>

        <div className="relative flex items-center gap-2 rounded-full border bg-card px-3 shadow-sm">
          <SearchIcon className="text-muted-foreground" />
          <Input
            className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Agregá un lugar..."
            value={query}
          />
        </div>
        {searchResults.length > 0 && (
          <Card size="sm">
            <CardContent className="flex flex-col gap-2">
              {searchResults.map((place) => (
                <Button
                  className="h-auto justify-start gap-3 px-2 py-2"
                  key={place.id}
                  onClick={() => {
                    addPlace(place.id);
                    setQuery("");
                  }}
                  type="button"
                  variant="ghost"
                >
                  <Photo className="size-9 rounded-md" seed={place.id} />
                  <span className="flex flex-col items-start">
                    <span>{place.name}</span>
                    <span className="text-xs text-muted-foreground">{place.tag}</span>
                  </span>
                  <PlusIcon className="ml-auto" />
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="flex gap-2">
          <Button className="flex-1 rounded-full" onClick={orderWithAi} type="button" variant="outline">
            <SparklesIcon data-icon="inline-start" />
            Ordenar con IA
          </Button>
          <Button className="rounded-full" onClick={() => setShowPreferences((value) => !value)} type="button" variant="outline">
            Gustos
          </Button>
        </div>

        {showPreferences && (
          <Card>
            <CardHeader>
              <CardDescription>¿Qué disfrutás más? La IA prioriza estos intereses al ordenar.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {interestTags.map((tag) => (
                <Button
                  key={tag}
                  onClick={() => togglePreference(tag)}
                  size="sm"
                  type="button"
                  variant={preferences.includes(tag) ? "default" : "outline"}
                >
                  {tag}
                </Button>
              ))}
            </CardContent>
          </Card>
        )}

        {aiNote && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="flex items-start gap-2 text-sm">
              <SparklesIcon className="mt-0.5 text-primary" />
              <span>{aiNote}</span>
            </CardContent>
          </Card>
        )}

        <SectionRow action="Reordená con ↑ ↓">Tu orden</SectionRow>
        <div className="flex flex-col gap-2">
          {wishlist.map((item, index) => (
            <PlaceRow
              canMoveDown={index < wishlist.length - 1}
              canMoveUp={index > 0}
              item={item}
              key={item.id}
              movePlace={movePlace}
              number={index + 1}
              onDuration={cycleDuration}
              onRemove={removePlace}
            />
          ))}
        </div>

        {visibleSuggestions.length > 0 && (
          <section className="flex flex-col gap-3">
            <Kicker>
              <SparklesIcon data-icon="inline-start" />
              Sugerencias para vos
            </Kicker>
            <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2">
              {visibleSuggestions.map((id) => {
                const place = placeById(id);
                return (
                  <Card className="w-40 shrink-0" key={id}>
                    <Photo className="mx-3 h-24 rounded-lg" seed={id} />
                    <CardHeader>
                      <CardTitle>{place.name}</CardTitle>
                      <CardDescription>
                        {place.tag} · {formatDuration(place.duration)}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button className="w-full rounded-full" onClick={() => addPlace(id)} size="sm" type="button" variant="secondary">
                        <PlusIcon data-icon="inline-start" />
                        Sumar
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </ScrollContent>
      <BottomBar>
        <div className="flex items-center gap-3">
          <div className="leading-tight">
            <p className="text-lg font-semibold">{wishlist.length} lugares</p>
            <p className="text-xs text-muted-foreground">~{days} días</p>
          </div>
          <Button className="h-12 flex-1 rounded-full" disabled={wishlist.length === 0} onClick={() => go("generate")} type="button">
            <SparklesIcon data-icon="inline-start" />
            Generar itinerario
          </Button>
        </div>
      </BottomBar>
    </ScreenShell>
  );
}

function PlaceRow({
  canMoveDown,
  canMoveUp,
  item,
  movePlace,
  number,
  onDuration,
  onRemove,
}: {
  canMoveDown: boolean;
  canMoveUp: boolean;
  item: WishlistItem;
  movePlace: (id: PlaceId, direction: -1 | 1) => void;
  number: number;
  onDuration: (id: PlaceId) => void;
  onRemove: (id: PlaceId) => void;
}) {
  const place = placeById(item.id);

  return (
    <Card size="sm">
      <CardContent className="flex items-center gap-3">
        <Badge className="size-7 rounded-full p-0" variant="secondary">{number}</Badge>
        <Photo className="size-14 shrink-0 rounded-lg" seed={item.id} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{place.name}</p>
          <div className="mt-1 flex items-center gap-2">
            <Button onClick={() => onDuration(item.id)} size="xs" type="button" variant="outline">
              <ClockIcon data-icon="inline-start" />
              {formatDuration(item.duration)}
            </Button>
            <Badge variant="outline">{place.tag}</Badge>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Button disabled={!canMoveUp} onClick={() => movePlace(item.id, -1)} size="icon-xs" type="button" variant="ghost">
            ↑
          </Button>
          <Button disabled={!canMoveDown} onClick={() => movePlace(item.id, 1)} size="icon-xs" type="button" variant="ghost">
            ↓
          </Button>
        </div>
        <Button onClick={() => onRemove(item.id)} size="icon-sm" type="button" variant="ghost">
          <XIcon />
        </Button>
      </CardContent>
    </Card>
  );
}

function GenerateScreen({ go, wishlistSize }: { go: (next: Screen, replace?: boolean) => void; wishlistSize: number }) {
  const [step, setStep] = useState(0);
  const steps = useMemo(
    () => [
      `Leyendo tus ${wishlistSize} lugares`,
      "Ordenando por cercanía y horarios",
      "Calculando trayectos a pie",
      "Rellenando los huecos libres",
    ],
    [wishlistSize],
  );

  useEffect(() => {
    const timers = steps.map((_, index) => window.setTimeout(() => setStep(index + 1), 650 * (index + 1)));
    timers.push(window.setTimeout(() => go("itinerary", true), 650 * steps.length + 700));
    return () => timers.forEach(window.clearTimeout);
  }, [go, steps]);

  return (
    <ScreenShell className="items-center justify-center px-8 text-center">
      <div className="mb-8 flex size-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/20">
        <SparklesIcon className="size-10" />
      </div>
      <Kicker>Armando tu viaje</Kicker>
      <h1 className="mt-3 max-w-72 text-3xl font-semibold leading-tight tracking-tight">Diseñando los 3 días perfectos en Madrid</h1>
      <div className="mt-8 flex w-full max-w-72 flex-col gap-3 text-left">
        {steps.map((item, index) => (
          <div className={cn("flex items-center gap-3 text-sm transition-opacity", index > step && "opacity-40")} key={item}>
            <span className={cn("flex size-6 items-center justify-center rounded-full border", index < step && "border-primary bg-primary text-primary-foreground")}>
              {index < step ? <CheckIcon /> : index === step ? <RefreshCwIcon className="animate-spin" /> : null}
            </span>
            {item}
          </div>
        ))}
      </div>
    </ScreenShell>
  );
}

function ItineraryScreen({ back, go }: { back: () => void; go: (next: Screen) => void }) {
  const [dayIndex, setDayIndex] = useState(0);
  const day = itinerary[dayIndex];

  return (
    <ScreenShell>
      <Header back={back} right={<Button size="icon-sm" type="button" variant="outline"><Share2Icon /></Button>} title="Tu itinerario" />
      <Tabs className="min-h-0 flex-1" defaultValue="list">
        <div className="flex flex-col gap-3 px-5 pb-3">
          <Kicker>
            <NavigationIcon data-icon="inline-start" />
            Madrid · España · {day.version}
          </Kicker>
          <h1 className="text-3xl font-semibold tracking-tight">3 días, listos</h1>
          <TabsList className="w-full">
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="map">Mapa</TabsTrigger>
          </TabsList>
          <div className="-mx-5 flex gap-2 overflow-x-auto px-5">
            {itinerary.map((item, index) => (
              <Button
                className="h-auto shrink-0 flex-col items-start rounded-xl px-4 py-2"
                key={item.label}
                onClick={() => setDayIndex(index)}
                type="button"
                variant={index === dayIndex ? "default" : "outline"}
              >
                <span>{item.label}</span>
                <span className="text-xs opacity-70">{item.version}</span>
              </Button>
            ))}
          </div>
        </div>
        <TabsContent className="min-h-0" value="list">
          <ScrollContent className="pt-0">
            <Timeline day={day} />
          </ScrollContent>
        </TabsContent>
        <TabsContent className="min-h-0" value="map">
          <MapView />
        </TabsContent>
      </Tabs>
      <BottomBar>
        <Button className="h-12 w-full rounded-full" onClick={() => go("travel")} type="button">
          Iniciar modo viaje
          <ArrowRightIcon data-icon="inline-end" />
        </Button>
      </BottomBar>
    </ScreenShell>
  );
}

function Timeline({ day }: { day: ItineraryDay }) {
  const [addedGaps, setAddedGaps] = useState<Record<number, boolean>>({});

  return (
    <div className="flex flex-col">
      <div className="mb-4 flex items-baseline gap-3">
        <h2 className="text-xl font-semibold">{day.sub}</h2>
        <span className="text-sm text-muted-foreground">
          Día {day.dayNumber} · {day.date}
        </span>
      </div>
      {day.items.map((item, index) => {
        if (item.type === "move") {
          return (
            <div className="ml-[3.55rem] border-l px-4 py-1 text-xs font-medium text-muted-foreground" key={index}>
              {item.mode === "walk" ? "A pie" : "Metro"} · {item.mins} min{item.text ? ` · ${item.text}` : ""}
            </div>
          );
        }

        return (
          <div className="grid grid-cols-[3rem_1rem_1fr] gap-2" key={index}>
            <time className="pt-3 text-right text-xs font-semibold">{item.type === "stop" ? item.start : item.from}</time>
            <div className="relative flex justify-center">
              <span className="absolute inset-y-0 w-px bg-border" />
              <span className={cn("relative mt-4 size-3 rounded-full border bg-background", item.type === "stop" ? "border-primary bg-primary" : "border-primary border-dashed")} />
            </div>
            <div className="pb-4">
              {item.type === "stop" ? (
                <StopCard item={item} />
              ) : (
                <Card className="border-primary/40 bg-primary/5">
                  <CardHeader>
                    <Badge className="w-fit" variant="outline">
                      <SparklesIcon data-icon="inline-start" />
                      Hueco libre · {item.kind}
                    </Badge>
                    <CardTitle>{item.title}</CardTitle>
                    <CardDescription>{item.note}</CardDescription>
                  </CardHeader>
                  <CardFooter>
                    {addedGaps[index] ? (
                      <Badge>
                        <CheckIcon data-icon="inline-start" />
                        Agregado al plan
                      </Badge>
                    ) : (
                      <Button onClick={() => setAddedGaps((current) => ({ ...current, [index]: true }))} size="sm" type="button">
                        <PlusIcon data-icon="inline-start" />
                        Sumar al plan
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StopCard({ item }: { item: ItineraryStop }) {
  const place = placeById(item.id);

  return (
    <Card size="sm">
      <CardContent className="flex gap-3">
        <Photo className="size-16 shrink-0 rounded-lg" seed={item.id} />
        <div className="min-w-0">
          <p className="font-semibold">{place.name}</p>
          <p className="text-xs text-muted-foreground">
            {place.tag} · {formatDuration(place.duration)}
          </p>
          {item.meal && <Badge className="mt-2" variant="secondary">{item.meal}</Badge>}
        </div>
      </CardContent>
    </Card>
  );
}

function MapView() {
  const [selected, setSelected] = useState(0);
  const path = mapStops.map((stop) => `${stop.x},${stop.y}`).join(" ");

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-muted">
      <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 440">
        <rect className="fill-muted" height="440" width="360" />
        {[
          [20, 60, 70, 55],
          [100, 40, 60, 80],
          [170, 70, 55, 60],
          [40, 140, 60, 70],
          [120, 150, 70, 55],
          [210, 150, 55, 70],
          [30, 250, 70, 80],
          [120, 260, 80, 60],
          [40, 350, 90, 60],
          [150, 340, 70, 70],
        ].map(([x, y, width, height], index) => (
          <rect className="fill-card" height={height} key={index} opacity="0.7" rx="7" width={width} x={x} y={y} />
        ))}
        <rect className="fill-primary/20" height="150" rx="16" width="92" x="252" y="250" />
        {["M0 120 H360", "M0 232 H360", "M0 330 H360", "M95 0 V440", "M205 0 V440", "M300 0 V440"].map((d) => (
          <path className="stroke-background" d={d} fill="none" key={d} opacity="0.9" strokeWidth="9" />
        ))}
        <polyline className="stroke-primary" fill="none" opacity="0.95" points={path} strokeDasharray="1 9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
      </svg>
      <Badge className="absolute left-4 top-4 shadow-sm" variant="secondary">
        <MapIcon data-icon="inline-start" />
        Ruta del Día 1
      </Badge>
      {mapStops.map((stop, index) => (
        <button
          className={cn(
            "absolute flex size-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full border-2 border-primary bg-card text-xs font-bold text-primary shadow-lg",
            selected === index && "bg-primary text-primary-foreground",
          )}
          key={stop.id}
          onClick={() => setSelected(index)}
          style={{ left: `${(stop.x / 360) * 100}%`, top: `${(stop.y / 440) * 100}%` }}
          type="button"
        >
          {stop.n}
        </button>
      ))}
      <div className="absolute inset-x-0 bottom-7 flex gap-3 overflow-x-auto px-4">
        {mapStops.map((stop, index) => {
          const place = placeById(stop.id);
          return (
            <button className="text-left" key={stop.id} onClick={() => setSelected(index)} type="button">
              <Card className={cn("w-56", selected === index && "ring-primary")}>
                <CardContent className="flex gap-3">
                  <Photo className="size-12 shrink-0 rounded-md" seed={stop.id} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{stop.time}</p>
                    <p className="truncate font-semibold">{place.name}</p>
                    <p className="text-xs text-muted-foreground">Parada {stop.n}</p>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TravelScreen({ back }: { back: () => void }) {
  const stops = itinerary[0].items.filter((item): item is ItineraryStop => item.type === "stop");
  const [index, setIndex] = useState(1);
  const [trimmed, setTrimmed] = useState(false);
  const [dropped, setDropped] = useState<PlaceId[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const visibleStops = stops.filter((stop) => !dropped.includes(stop.id));
  const done = index >= visibleStops.length;
  const current = visibleStops[Math.min(index, visibleStops.length - 1)];
  const upcoming = visibleStops.slice(index + 1);
  const points = 60 + index * 40;

  const applyReplan = (mode: "trim" | "recalc" | "keep") => {
    if (mode === "trim") setTrimmed(true);
    if (mode === "recalc" && upcoming.length > 0) setDropped((currentDropped) => [...currentDropped, upcoming[upcoming.length - 1].id]);
    setSheetOpen(false);
  };

  return (
    <ScreenShell className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-72 opacity-80">
        <TravelMiniMap currentId={current?.id} doneIds={visibleStops.slice(0, index).map((stop) => stop.id)} stopIds={visibleStops.map((stop) => stop.id)} />
      </div>
      <div className="absolute inset-x-4 top-12 flex items-center justify-between">
        <Button className="rounded-full bg-card/90" onClick={back} size="icon-lg" type="button" variant="outline">
          <ArrowLeftIcon />
        </Button>
        <Badge className="bg-card/90 shadow-sm" variant="secondary">● Modo viaje · Día 1</Badge>
        <Button className="rounded-full bg-card/90" onClick={back} size="icon-lg" type="button" variant="outline">
          <StarIcon />
        </Button>
      </div>
      <ScrollContent className="relative pt-56">
        {!done ? (
          <>
            <Card className="shadow-xl">
              <CardHeader>
                <Badge className="w-fit" variant="secondary">● Estás acá</Badge>
              </CardHeader>
              <CardContent className="flex gap-4">
                <Photo className="size-24 shrink-0 rounded-xl" seed={current.id} />
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight">{placeById(current.id).name}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{placeById(current.id).note}</p>
                  <Badge className="mt-3" variant="secondary">
                    <ClockIcon data-icon="inline-start" />
                    Hasta las {current.end} · {formatDuration(trimmed ? trimDuration(placeById(current.id).duration) : placeById(current.id).duration)}
                  </Badge>
                </div>
              </CardContent>
              {trimmed && <CardFooter className="text-xs text-muted-foreground">Tiempos recortados para recuperar el atraso</CardFooter>}
            </Card>

            <section className="flex flex-col gap-2">
              <Kicker>
                <NavigationIcon data-icon="inline-start" />
                A continuación
              </Kicker>
              {upcoming.map((stop) => (
                <Card key={stop.id} size="sm">
                  <CardContent className="flex items-center gap-3">
                    <strong className="w-12 text-center text-sm">{stop.start}</strong>
                    <Photo className="size-11 shrink-0 rounded-md" seed={stop.id} />
                    <div>
                      <p className="font-semibold">{placeById(stop.id).name}</p>
                      <p className="text-xs text-muted-foreground">
                        {placeById(stop.id).tag} · {formatDuration(trimmed ? trimDuration(placeById(stop.id).duration) : placeById(stop.id).duration)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </section>

            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="puntos de hoy" value={points} />
              <ScoreCard label="paradas hechas" value={`${index}/${visibleStops.length}`} />
            </div>
          </>
        ) : (
          <Card className="mt-5 text-center">
            <CardHeader>
              <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <StarIcon className="size-9" />
              </div>
              <CardTitle className="text-2xl">¡Día 1 completado!</CardTitle>
              <CardDescription>Recorriste {visibleStops.length} lugares y sumaste {points} puntos.</CardDescription>
            </CardHeader>
          </Card>
        )}
      </ScrollContent>
      <BottomBar>
        {done ? (
          <Button className="h-12 w-full rounded-full" onClick={back} type="button">
            Ver resumen del viaje
            <ArrowRightIcon data-icon="inline-end" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button className="h-12 rounded-full" onClick={() => setSheetOpen(true)} type="button" variant="outline">
              <RefreshCwIcon data-icon="inline-start" />
              Replanificar
            </Button>
            <Button className="h-12 flex-1 rounded-full" onClick={() => setIndex((currentIndex) => currentIndex + 1)} type="button">
              Siguiente parada
              <CheckIcon data-icon="inline-end" />
            </Button>
          </div>
        )}
      </BottomBar>
      <ReplanSheet onApply={applyReplan} onOpenChange={setSheetOpen} open={sheetOpen} upcoming={upcoming} />
    </ScreenShell>
  );
}

function ReplanSheet({
  onApply,
  onOpenChange,
  open,
  upcoming,
}: {
  onApply: (mode: "trim" | "recalc" | "keep") => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  upcoming: ItineraryStop[];
}) {
  const drop = upcoming.at(-1);

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="z-[100] mx-auto max-w-3xl rounded-t-3xl bg-card shadow-2xl" side="bottom">
        <SheetHeader>
          <SheetTitle>Replanificar</SheetTitle>
          <SheetDescription>Vas ~40 min retrasado. Rumbo puede ajustar el plan para que llegues a tiempo.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4">
          <ReplanOption description="Mantenés tus paradas, un poco más cortas." onClick={() => onApply("trim")} title="Recortar tiempos" />
          <ReplanOption
            description={drop ? `Quitaríamos ${placeById(drop.id).name} para llegar con margen.` : "No queda nada por quitar."}
            onClick={() => onApply("recalc")}
            title="Recalcular itinerario"
          />
          <ReplanOption description="Seguís con el plan original." onClick={() => onApply("keep")} title="Mantener mi itinerario" />
        </div>
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

function TravelMiniMap({ currentId, doneIds, stopIds }: { currentId?: PlaceId; doneIds: PlaceId[]; stopIds: PlaceId[] }) {
  const pins = mapStops.filter((stop) => stopIds.includes(stop.id));
  const path = pins.map((stop) => `${stop.x},${Math.max(48, stop.y - 20)}`).join(" ");

  return (
    <div className="relative size-full overflow-hidden bg-muted">
      <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="xMidYMid slice" viewBox="0 0 360 300">
        <rect className="fill-muted" height="300" width="360" />
        {[
          [20, 30, 70, 55],
          [110, 20, 60, 70],
          [180, 50, 55, 55],
          [40, 120, 60, 70],
          [120, 130, 70, 55],
          [210, 120, 60, 70],
          [30, 220, 70, 70],
          [130, 230, 80, 60],
          [250, 210, 90, 90],
        ].map(([x, y, width, height], index) => (
          <rect className="fill-card" height={height} key={index} opacity="0.7" rx="7" width={width} x={x} y={y} />
        ))}
        {["M0 105 H360", "M0 200 H360", "M95 0 V300", "M205 0 V300", "M300 0 V300"].map((d) => (
          <path className="stroke-background" d={d} fill="none" key={d} opacity="0.9" strokeWidth="9" />
        ))}
        <polyline className="stroke-primary" fill="none" opacity="0.9" points={path} strokeDasharray="1 9" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" />
        {pins.map((stop) => {
          const done = doneIds.includes(stop.id);
          const current = stop.id === currentId;

          return (
            <g key={stop.id} transform={`translate(${stop.x},${Math.max(48, stop.y - 20)})`}>
              {current && <circle className="fill-primary/20" r="18" />}
              <circle className={current ? "fill-primary" : done ? "fill-card" : "fill-background"} r={current ? "8" : "6"} stroke="currentColor" strokeWidth={done ? "2" : "3"} />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />
    </div>
  );
}

function ReplanOption({ description, onClick, title }: { description: string; onClick: () => void; title: string }) {
  return (
    <Button className="h-auto justify-start rounded-xl px-4 py-4 text-left" onClick={onClick} type="button" variant="outline">
      <span className="flex flex-col items-start gap-1">
        <span>{title}</span>
        <span className="text-xs font-normal text-muted-foreground">{description}</span>
      </span>
    </Button>
  );
}

function ScoreCard({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <p className="text-xl font-semibold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Header({
  back,
  large = false,
  right,
  subtitle,
  title,
}: {
  back?: () => void;
  large?: boolean;
  right?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <header className={cn("flex shrink-0 flex-col gap-3 px-5", large ? "pt-12" : "pt-11")}>
      <div className="flex min-h-10 items-center justify-between gap-3">
        {back ? (
          <Button onClick={back} size="icon-lg" type="button" variant="outline">
            <ArrowLeftIcon />
          </Button>
        ) : (
          <span className="size-10" />
        )}
        {!large && <strong className="truncate text-base">{title}</strong>}
        {right ?? <span className="size-10" />}
      </div>
      {large && (
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}

function ScreenShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex h-full flex-col bg-background text-foreground", className)}>{children}</div>;
}

function ScrollContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4", className)}>{children}</div>;
}

function BottomBar({ children }: { children: ReactNode }) {
  return <div className="shrink-0 border-t bg-background/95 px-5 pb-7 pt-3 backdrop-blur">{children}</div>;
}

function SectionRow({ action, children }: { action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between px-0.5">
      <Kicker>{children}</Kicker>
      {action && <span className="text-xs font-medium text-muted-foreground">{action}</span>}
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-primary">{children}</div>;
}

function Photo({ children, className, seed }: { children?: ReactNode; className?: string; seed: string }) {
  const palette = photoPalettes[hashSeed(seed) % photoPalettes.length];

  return (
    <div className={cn("relative flex overflow-hidden bg-muted", className)} style={{ background: `linear-gradient(150deg, ${palette[0]}, ${palette[1]})` }}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_8%,rgba(255,255,255,.38),transparent_55%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-foreground/35" />
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
}

const photoPalettes = [
  ["#e3b79c", "#b05e40"],
  ["#c7d4b2", "#6e8c56"],
  ["#a9c3d6", "#577e96"],
  ["#e7cba1", "#bc8a52"],
  ["#d6b4c6", "#915f7f"],
  ["#b9c2ce", "#5c6b7e"],
];

function hashSeed(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}
