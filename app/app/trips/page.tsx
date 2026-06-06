import Link from "next/link";
import { ArrowRightIcon, PlusIcon } from "lucide-react";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TripsPage() {
  return (
    <PageShell
      actions={
        <Button render={<Link href="/app/trips/new/destination" />}>
          <PlusIcon data-icon="inline-start" />
          Nuevo viaje
        </Button>
      }
      eyebrow="Home del mock"
      title="Tus viajes"
    >
      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/app/trips/new/places">
          <Card className="h-full transition hover:ring-primary/40">
            <CardHeader>
              <div className="flex items-center gap-2">
                <CardTitle>Madrid</CardTitle>
                <Badge variant="secondary">Borrador</Badge>
              </div>
              <CardDescription>12 - 14 jun · 5 lugares</CardDescription>
            </CardHeader>
            <CardContent className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
              Seguir armando <ArrowRightIcon className="size-4" />
            </CardContent>
          </Card>
        </Link>
        <Card className="opacity-80">
          <CardHeader>
            <CardTitle>Lisboa</CardTitle>
            <CardDescription>mar 2026 · 4 días</CardDescription>
          </CardHeader>
          <CardContent className="text-sm font-medium text-muted-foreground">
            Completado
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
