"use client";

import { BookmarkIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

export function SaveTripButton({ tripId }: { tripId: string }) {
  const [pending, setPending] = useState(false);

  async function saveTrip() {
    setPending(true);

    try {
      await fetch(`/api/trips/${tripId}/save`, { method: "POST" });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      aria-label="Guardar viaje"
      disabled={pending}
      onClick={saveTrip}
      size="icon-lg"
      variant="outline"
    >
      <BookmarkIcon />
    </Button>
  );
}
