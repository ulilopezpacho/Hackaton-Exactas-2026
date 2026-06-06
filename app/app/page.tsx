import Link from "next/link";
import { PlusIcon } from "lucide-react";

import { PageShell, WorkCard, WorkGrid } from "@/components/app/page-shell";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <PageShell
      actions={
        <Button className="h-10" render={<Link href="/app/trips/new/destination" />}>
          <PlusIcon data-icon="inline-start" />
          Crear viaje
        </Button>
      }
      eyebrow="Home"
      title="Mis viajes"
    >
      <WorkGrid>
        <WorkCard
          description="Listado de viajes, borradores y accesos rápidos."
          href="/app/trips"
          owner="equipo home/listado"
          status="Base"
          title="Tus viajes"
        />
        <WorkCard
          description="Datos del usuario y preferencias de viaje."
          href="/app/profile"
          owner="equipo perfil"
          title="Perfil"
        />
      </WorkGrid>
    </PageShell>
  );
}
