import Link from "next/link";
import { CheckIcon, RefreshCwIcon, SparklesIcon } from "lucide-react";

import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  "Leyendo tus 5 lugares",
  "Ordenando por cercanía y horarios",
  "Calculando trayectos a pie",
  "Rellenando los huecos libres",
];

export default function GeneratingPage() {
  return (
    <PageShell eyebrow="Armando tu viaje" title="Diseñando los 3 días perfectos en Madrid">
      <Card>
        <CardContent className="flex flex-col items-center gap-6 py-8 text-center">
          <div className="flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl shadow-primary/20">
            <SparklesIcon className="size-9" />
          </div>
          <div className="grid w-full max-w-sm gap-3 text-left">
            {steps.map((step, index) => (
              <div className="flex items-center gap-3 text-sm" key={step}>
                <span className="flex size-6 items-center justify-center rounded-full border border-primary bg-primary text-primary-foreground">
                  {index === steps.length - 1 ? (
                    <RefreshCwIcon className="size-3 animate-spin" />
                  ) : (
                    <CheckIcon className="size-3" />
                  )}
                </span>
                {step}
              </div>
            ))}
          </div>
          <Button render={<Link href="/app/trips/madrid-demo/itinerary" />}>
            Ver itinerario
          </Button>
        </CardContent>
      </Card>
    </PageShell>
  );
}
