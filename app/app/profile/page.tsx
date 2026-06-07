import { redirect } from "next/navigation";

import { PageShell } from "@/components/app/page-shell";
import {
  BudgetFields,
  InterestFields,
  InterestRequirement,
  PaceFields,
  PreferenceHint,
  PromptField,
} from "@/components/app/preferences-fields";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from "@/utils/supabase/server";

import { saveProfilePreferences } from "../preferences/actions";

type ProfilePageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const supabase = await createClient();
  const params = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: preferences } = await supabase
    .from("user_preferences")
    .select("budget, interests, pace, travel_style_prompt")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (!preferences) {
    redirect("/app/onboarding");
  }

  const profileName = String(user?.user_metadata.name ?? user?.user_metadata.full_name ?? user?.email ?? "Tu perfil");
  const initial = profileName.trim().charAt(0).toUpperCase() || "R";
  const email = user?.email ?? "Perfil";

  return (
    <PageShell eyebrow="Perfil" title="Mi perfil">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-primary text-2xl font-semibold text-primary-foreground">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-semibold text-foreground md:text-lg">{email}</p>
          </div>
        </CardContent>
      </Card>
      <form action={saveProfilePreferences}>
        <Card>
          <CardHeader>
            <CardTitle>Preferencias de viaje</CardTitle>
            <CardDescription>
              Ajustá cómo querés que Rumbo priorice lugares, tiempos y recomendaciones.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-7">
            {params.error ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error}
              </p>
            ) : null}
            <section className="grid gap-3">
              <InterestRequirement />
              <InterestFields selected={preferences.interests} />
            </section>
            <section className="grid gap-3">
              <PreferenceHint>Elegí el ritmo que más se parezca a tus viajes ideales.</PreferenceHint>
              <PaceFields selected={preferences.pace} />
            </section>
            <section className="grid gap-3">
              <PromptField value={preferences.travel_style_prompt} />
            </section>
            <section className="grid gap-3">
              <PreferenceHint>Presupuesto promedio diario en USD.</PreferenceHint>
              <BudgetFields selected={preferences.budget} />
            </section>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Guardar cambios</Button>
          </CardFooter>
        </Card>
      </form>
    </PageShell>
  );
}
