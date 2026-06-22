"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, SparklesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlacePriority } from "@/lib/places/priority";

type StepStatus = "pending" | "loading" | "completed";

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: "reading", label: "Leyendo tu lista y preferencias" },
  { id: "ordering", label: "Ordenando por cercanía y horarios" },
  { id: "calculating", label: "Calculando trayectos a pie" },
  { id: "filling", label: "Rellenando los huecos libres" },
];

export function ItineraryWizard({
  tripId,
  placeIds,
  priorities,
  tripTitle,
  dayCount,
}: {
  tripId: string;
  placeIds: string[];
  priorities?: Record<string, PlacePriority>;
  tripTitle: string;
  dayCount: number;
}) {
  const router = useRouter();
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({
    reading: "loading",
    ordering: "pending",
    calculating: "pending",
    filling: "pending",
  });
  const [error, setError] = useState<string | null>(null);
  const apiCalled = useRef(false);

  useEffect(() => {
    if (apiCalled.current) return;
    apiCalled.current = true;

    async function startGeneration() {
      try {
        // The catalog is no longer generated here — the itinerary is built only
        // from the places the user loaded into their list (manual + AI).
        const generationPromise = fetch("/api/itinerary/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, placeIds, priorities }),
        });

        await advanceStep("reading", 1200);
        await advanceStep("ordering", 2000);
        await advanceStep("calculating", 1500);
        
        // Final step: wait for the actual API result
        setStepStatuses((prev) => ({ ...prev, filling: "loading" }));
        
        const response = await generationPromise;
        if (!response.ok) {
          const body = await response.json();
          throw new Error(body.error ?? "Error generando el itinerario");
        }

        setStepStatuses((prev) => ({ ...prev, filling: "completed" }));

        // Small delay to show completion before redirect
        setTimeout(() => {
          router.replace(`/app/trips/${tripId}/itinerary`);
        }, 1000);
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Algo salió mal");
      }
    }

    async function advanceStep(id: string, delay: number) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      setStepStatuses((prev) => {
        const next = { ...prev };
        next[id] = "completed";
        const nextStep = STEPS[STEPS.findIndex((s) => s.id === id) + 1];
        if (nextStep) {
          next[nextStep.id] = "loading";
        }
        return next;
      });
    }

    void startGeneration();
  }, [tripId, placeIds, priorities, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="size-16 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
          <SparklesIcon className="size-8" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Ups, hubo un problema</h2>
          <p className="mt-2 text-muted-foreground max-w-xs">{error}</p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 rounded-[10px] bg-primary px-6 py-2 font-medium text-primary-foreground"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-10">
      <div className="relative mb-12 flex size-24 items-center justify-center rounded-[20px] bg-primary text-primary-foreground shadow-xl shadow-primary/20">
        <div className="absolute inset-0 animate-ping rounded-full bg-primary/20 duration-1000" />
        <SparklesIcon className="size-12" />
      </div>

      <div className="text-center">
        <p className="mb-2 text-sm font-semibold text-primary/80">
          Armando tu viaje
        </p>
        <h1 className="max-w-xs text-3xl font-semibold leading-tight text-foreground">
          Diseñando los {dayCount} días perfectos en {tripTitle}
        </h1>
      </div>

      <div className="mt-12 w-full max-w-xs space-y-6">
        {STEPS.map((step) => {
          const status = stepStatuses[step.id];
          return (
            <div
              key={step.id}
              className={cn(
                "flex items-center gap-4 transition-all duration-500",
                status === "pending" ? "opacity-30 grayscale" : "opacity-100",
              )}
            >
              <div className="relative flex size-6 items-center justify-center">
                {status === "completed" ? (
                  <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground animate-in zoom-in duration-300">
                    <CheckIcon className="size-3.5 stroke-[3]" />
                  </div>
                ) : status === "loading" ? (
                  <div className="flex size-6 items-center justify-center rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                ) : (
                  <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>
              <p
                className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  status === "completed"
                    ? "text-foreground"
                    : status === "loading"
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground",
                )}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
