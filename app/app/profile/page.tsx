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
import { createClient } from "@/utils/supabase/server";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageShell
      actions={
        <Button render={<Link href="/app/profile/preferences" />} variant="outline">
          Editar preferencias
        </Button>
      }
      eyebrow="Perfil"
      title="Tu cuenta"
    >
      <Card>
        <CardHeader>
          <CardTitle>{user?.email}</CardTitle>
          <CardDescription>Sesión activa con Supabase Auth.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          ID: {user?.id}
        </CardContent>
      </Card>
    </PageShell>
  );
}
