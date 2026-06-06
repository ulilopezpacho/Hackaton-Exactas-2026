import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { TripsList, type Trip } from "./trips-list";

const trips: Trip[] = [
  {
    city: "Lisboa",
    country: "Portugal",
    dates: "mar 2026",
    days: "4 días",
    href: "/app/trips/lisboa",
    places: "4 días completos",
    stripeClass: "from-[#A9C3D6] to-[#577E96]",
    status: "completed",
    tone: "Miradores, barrios y ritmo tranquilo",
  },
  {
    city: "Bariloche",
    country: "Argentina",
    dates: "ago 2026",
    days: "5 días",
    href: "/app/trips/bariloche",
    places: "8 lugares",
    stripeClass: "from-[#C7D4B2] to-[#6E8C56]",
    status: "upcoming",
    tone: "Lagos, senderos y chocolate",
  },
  {
    city: "Madrid",
    country: "España",
    dates: "12 - 14 jun",
    days: "3 días",
    href: "/app/trips/madrid",
    places: "5 lugares",
    stripeClass: "from-[#E7CBA1] to-[#BC8A52]",
    status: "draft",
    tone: "Arte, tapas y caminatas cortas",
  },
];

export default function TripsPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl font-semibold tracking-normal">
            Mis viajes
          </h1>
        </div>
        <Button className="h-10 rounded-full px-5" render={<Link href="/app/trips/new/destination" />}>
          <PlusIcon data-icon="inline-start" />
          Nuevo viaje
        </Button>
      </div>

      <TripsList trips={trips} />
    </section>
  );
}
