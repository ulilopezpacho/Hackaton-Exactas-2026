import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type SettingsPageProps = {
  params: Promise<{
    tripId: string;
  }>;
};

export default async function TripSettingsPage({ params }: SettingsPageProps) {
  const { tripId } = await params;

  return (
    <PageShell
      actions={
        <Button render={<Link href={`/app/trips/${tripId}`} />} variant="outline">
          Volver al viaje
        </Button>
      }
      eyebrow="Settings"
      title="Configuración del viaje"
    >
      <Card>
        <CardHeader>
          <CardTitle>Madrid · España</CardTitle>
          <CardDescription>12 - 14 jun · privado</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Pantalla para editar destino, fechas, título y visibilidad cuando el
          equipo de viajes conecte Supabase.
        </CardContent>
      </Card>
    </PageShell>
  );
}
