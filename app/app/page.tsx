import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  CompassIcon,
  MapPinnedIcon,
  PlaneTakeoffIcon,
  PlusIcon,
  RouteIcon,
  SparklesIcon,
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

const nextTrip = {
  city: "Madrid",
  country: "España",
  dates: "12 - 14 jun",
  days: "3 días",
  places: "5 lugares guardados",
  version: "Itinerario equilibrado",
  href: "/app/trips/madrid",
};

const stats = [
  { label: "Viajes", value: "2" },
  { label: "Borradores", value: "1" },
  { label: "Lugares", value: "9" },
];

const shortcuts = [
  {
    icon: PlusIcon,
    title: "Crear viaje",
    description: "Elegí destino, fechas y preferencias para armar una ruta nueva.",
    href: "/app/trips/new/destination",
  },
  {
    icon: RouteIcon,
    title: "Ver mis trips",
    description: "Revisá borradores, viajes próximos e itinerarios terminados.",
    href: "/app/trips",
  },
  {
    icon: CompassIcon,
    title: "Preferencias",
    description: "Ajustá ritmo, intereses y estilo de viaje para futuras propuestas.",
    href: "/app/profile/preferences",
  },
];

const activity = [
  ["Madrid", "Se agregó Mercado de San Miguel al Día 1", "hace 12 min"],
  ["Lisboa", "Itinerario de 4 días listo para revisar", "ayer"],
  ["Perfil", "Preferencias de comida actualizadas", "vie 5 jun"],
];

export default function HomePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 py-8">
      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        <div className="overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
          <div className="relative min-h-72 bg-linear-to-br from-[#E3B79C] to-[#B05E40] p-6 md:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_18%_8%,rgba(255,255,255,0.35),rgba(255,255,255,0)_55%)]" />
            <div className="absolute inset-0 bg-linear-to-t from-foreground/35 to-transparent" />
            <div className="relative flex flex-col justify-between gap-16">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-card/90 uppercase tracking-[0.16em] text-foreground" variant="secondary">
                  <SparklesIcon data-icon="inline-start" />
                  Nuevo
                </Badge>
              </div>
              <div className="text-primary-foreground">
                <h1 className="max-w-2xl font-heading text-4xl leading-[1.04] font-semibold text-balance md:text-6xl">
                  Decinos qué querés ver. Armamos el viaje.
                </h1>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    className="h-11 rounded-full bg-card px-5 text-foreground hover:bg-card/90"
                    render={<Link href="/app/trips/new/destination" />}
                    variant="secondary"
                  >
                    <PlusIcon data-icon="inline-start" />
                    Crear viaje
                  </Button>
                  <Button
                    className="h-11 rounded-full border-card/70 bg-transparent px-5 text-primary-foreground hover:bg-card/10"
                    render={<Link href="/app/trips" />}
                    variant="outline"
                  >
                    Ver mis trips
                    <ArrowRightIcon data-icon="inline-end" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            {stats.map((stat) => (
              <div
                className="rounded-xl border border-border bg-background/70 px-4 py-3"
                key={stat.label}
              >
                <p className="text-2xl font-semibold">{stat.value}</p>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <Badge className="w-fit rounded-md bg-accent text-accent-foreground" variant="secondary">
              Próximo viaje
            </Badge>
            <CardTitle className="text-3xl">{nextTrip.city}</CardTitle>
            <CardDescription>
              {nextTrip.country} · {nextTrip.version}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <div className="grid gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <CalendarDaysIcon className="size-4" />
                <span>{nextTrip.dates}</span>
              </div>
              <div className="flex items-center gap-3">
                <ClockIcon className="size-4" />
                <span>{nextTrip.days}</span>
              </div>
              <div className="flex items-center gap-3">
                <MapPinnedIcon className="size-4" />
                <span>{nextTrip.places}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button className="rounded-full" render={<Link href={nextTrip.href} />}>
                Abrir
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_19rem]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <SparklesIcon data-icon="inline-start" />
              Rumbo
            </Badge>
            <Badge variant="outline">Planificador inteligente</Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;

            return (
              <Link className="block" href={shortcut.href} key={shortcut.title}>
                <Card className="h-full transition hover:-translate-y-0.5 hover:ring-primary/30">
                  <CardHeader>
                    <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                      <Icon className="size-5" />
                    </div>
                    <CardTitle>{shortcut.title}</CardTitle>
                    <CardDescription>{shortcut.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <PlaneTakeoffIcon className="size-4" />
              Actividad reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {activity.map(([scope, detail, time]) => (
              <div className="grid gap-1 border-b pb-4 last:border-b-0 last:pb-0" key={detail}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">{scope}</p>
                  <time className="text-xs text-muted-foreground">{time}</time>
                </div>
                <p className="text-sm text-muted-foreground">{detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
