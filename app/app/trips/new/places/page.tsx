import Link from "next/link";
import { ClockIcon, SearchIcon, SparklesIcon } from "lucide-react";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const wishlist = [
  ["Palacio Real", "Historia", "2 h"],
  ["Museo del Prado", "Arte", "3 h"],
  ["Plaza Mayor", "Clásico", "1 h"],
  ["Mercado de San Miguel", "Gastro", "1 h"],
  ["Parque del Retiro", "Aire libre", "1 h 30"],
];

const suggestions = ["Museo Reina Sofía", "Templo de Debod", "Gran Vía"];

export default function PlacesPage() {
  return (
    <PageShell eyebrow="Wishlist del mock" title="¿Qué querés ver en Madrid?">
      <div className="flex items-center gap-2 rounded-full border bg-card px-3 shadow-sm">
        <SearchIcon className="size-4 text-muted-foreground" />
        <Input
          className="h-12 border-0 px-0 shadow-none focus-visible:ring-0"
          placeholder="Agregá un lugar..."
        />
      </div>
      <div className="flex gap-2">
        <Button className="rounded-full" variant="outline">
          <SparklesIcon data-icon="inline-start" />
          Ordenar con IA
        </Button>
        <Button
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/app/trips/new/preferences" />}
          variant="outline"
        >
          Gustos
        </Button>
      </div>
      <div className="grid gap-3">
        {wishlist.map(([name, tag, duration], index) => (
          <Card key={name} size="sm">
            <CardContent className="flex items-center gap-3">
              <Badge className="size-7 rounded-full p-0" variant="secondary">
                {index + 1}
              </Badge>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{name}</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="outline">
                    <ClockIcon data-icon="inline-start" />
                    {duration}
                  </Badge>
                  <Badge variant="outline">{tag}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <section className="grid gap-3 md:grid-cols-3">
        {suggestions.map((name) => (
          <Card key={name}>
            <CardHeader>
              <CardTitle>{name}</CardTitle>
            </CardHeader>
            <CardContent>
              <Button className="w-full rounded-full" size="sm" variant="secondary">
                Sumar
              </Button>
            </CardContent>
          </Card>
        ))}
      </section>
      <div className="flex justify-end">
        <Button
          nativeButton={false}
          render={<Link href="/app/trips/new/generating" />}
        >
          <SparklesIcon data-icon="inline-start" />
          Generar itinerario
        </Button>
      </div>
    </PageShell>
  );
}
