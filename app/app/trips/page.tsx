import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { BackButton } from "@/components/app/back-button";
import { Button } from "@/components/ui/button";
import { getTripsOverview } from "@/lib/trips/overview";

import { TripsList } from "./trips-list";

export default async function TripsPage() {
  const { trips } = await getTripsOverview();

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-7 px-5 py-8 md:py-10">
      <BackButton />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Tu mapa personal</p>
          <h1 className="text-4xl font-semibold tracking-tight">
            Mis viajes
          </h1>
        </div>
        <Button
          nativeButton={false}
          render={<Link href="/app/trips/new/destination" />}
        >
          <PlusIcon data-icon="inline-start" />
          Nuevo viaje
        </Button>
      </div>

      <TripsList trips={trips} />
    </section>
  );
}
