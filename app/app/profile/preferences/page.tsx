import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const preferences = ["Arte", "Historia", "Ritmo equilibrado", "Presupuesto medio"];

export default function ProfilePreferencesPage() {
  return (
    <PageShell
      actions={
        <Button render={<Link href="/app/profile" />} variant="outline">
          Volver
        </Button>
      }
      eyebrow="Perfil"
      title="Preferencias"
    >
      <Card>
        <CardHeader>
          <CardTitle>Gustos guardados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {preferences.map((preference) => (
            <Badge key={preference} variant="secondary">
              {preference}
            </Badge>
          ))}
        </CardContent>
      </Card>
    </PageShell>
  );
}
