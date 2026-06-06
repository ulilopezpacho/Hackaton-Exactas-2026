import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const interests = [
  "Arte",
  "Historia",
  "Gastro",
  "Aire libre",
  "Vistas",
  "Paseo",
  "Clásico",
  "Fútbol",
];

export default function TripPreferencesPage() {
  return (
    <PageShell eyebrow="Gustos" title="Preferencias para ordenar el viaje">
      <Card>
        <CardHeader>
          <CardTitle>¿Qué disfrutás más?</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {interests.map((interest, index) => (
            <Badge key={interest} variant={index < 2 ? "default" : "outline"}>
              {interest}
            </Badge>
          ))}
        </CardContent>
      </Card>
      <div className="flex justify-between gap-3">
        <Button render={<Link href="/app/trips/new/places" />} variant="outline">
          Volver
        </Button>
        <Button render={<Link href="/app/trips/new/generating" />}>
          Generar itinerario
        </Button>
      </div>
    </PageShell>
  );
}
