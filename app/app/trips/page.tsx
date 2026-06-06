import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getTripsOverview } from "@/lib/trips/overview";

import { TripsList } from "./trips-list";

export default async function TripsPage() {
  const { trips } = await getTripsOverview();

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
