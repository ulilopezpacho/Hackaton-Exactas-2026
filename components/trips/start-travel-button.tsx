"use client";

import { PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartTravelButton({
  className,
  isOwner,
  tripId,
}: {
  className?: string;
  isOwner: boolean;
  tripId: string;
}) {
  const router = useRouter();

  function startTravel() {
    if (!isOwner) {
      console.info(
        `[Rumbo] El usuario actual inició el modo viaje de otro usuario: ${tripId}`,
      );
    }

    router.push(`/app/trips/${tripId}/travel`);
  }

  return (
    <Button
      className={cn(className)}
      onClick={startTravel}
      size="lg"
    >
      <PlayIcon data-icon="inline-start" />
      Iniciar modo viaje
    </Button>
  );
}
