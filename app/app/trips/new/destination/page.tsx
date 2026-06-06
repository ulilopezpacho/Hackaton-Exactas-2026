import Link from "next/link";
import { CalendarDaysIcon, NavigationIcon } from "lucide-react";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const destinations = ["Madrid", "Lisboa", "Roma", "París", "CDMX", "Tokio"];
const days = Array.from({ length: 30 }, (_, index) => index + 1);

export default function DestinationPage() {
  return (
    <PageShell eyebrow="Nuevo viaje" title="Empecemos por lo básico">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <NavigationIcon className="size-4" />
              ¿A dónde vas?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {destinations.map((destination) => (
              <Badge
                key={destination}
                variant={destination === "Madrid" ? "default" : "outline"}
              >
                {destination}
              </Badge>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="inline-flex items-center gap-2">
              <CalendarDaysIcon className="size-4" />
              Junio 2026
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center text-sm">
              {days.map((day) => (
                <span
                  className={
                    day >= 12 && day <= 14
                      ? "rounded-full bg-primary px-2 py-2 text-primary-foreground"
                      : "rounded-full px-2 py-2 text-muted-foreground"
                  }
                  key={day}
                >
                  {day}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex justify-end">
        <Button
          nativeButton={false}
          render={<Link href="/app/trips/new/places" />}
        >
          Continuar
        </Button>
      </div>
    </PageShell>
  );
}
