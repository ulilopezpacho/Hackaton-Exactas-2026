import { redirect } from "next/navigation";

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
import { isOnboardingStep, type OnboardingStep } from "@/lib/preferences";
import { createClient } from "@/utils/supabase/server";

import {
  completeOnboardingBudget,
  saveOnboardingInterests,
  saveOnboardingPace,
  saveOnboardingPrompt,
} from "../preferences/actions";

type OnboardingPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

const stepCopy: Record<
  Exclude<OnboardingStep, "complete">,
  {
    button: string;
    eyebrow: string;
    title: string;
    description: string;
  }
> = {
  interests: {
    button: "Seguir",
    eyebrow: "Tus gustos",
    title: "¿Qué querés encontrar cuando viajás?",
    description: "Arrancamos con señales simples para que Rumbo ordene mejor cada itinerario.",
  },
  pace: {
    button: "Guardar ritmo",
    eyebrow: "Ritmo",
    title: "¿Cómo te gusta moverte?",
    description: "Esto ayuda a decidir cuántas paradas entran en un día sin que el viaje se sienta forzado.",
  },
  prompt: {
    button: "Continuar",
    eyebrow: "Tu estilo",
    title: "Dejá una nota para la IA",
    description: "Si querés, sumá una frase sobre cómo te gusta viajar. También podés dejarlo vacío.",
  },
  budget: {
    button: "Terminar onboarding",
    eyebrow: "Presupuesto",
    title: "¿Cuál es tu promedio por día?",
    description: "Usamos rangos en USD para ajustar recomendaciones sin pedir un número exacto.",
  },
};

const stepOrder: Exclude<OnboardingStep, "complete">[] = [
  "interests",
  "pace",
  "prompt",
  "budget",
];

async function getPreferences() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("budget, interests, onboarding_completed_at, onboarding_step, pace, travel_style_prompt, user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { error: "No pudimos cargar tus preferencias. Revisá que la migración de onboarding esté aplicada." };
  }

  if (data) {
    return { preferences: data };
  }

  const { data: created, error: createError } = await supabase
    .from("user_preferences")
    .insert({ user_id: user.id })
    .select("budget, interests, onboarding_completed_at, onboarding_step, pace, travel_style_prompt, user_id")
    .single();

  if (createError) {
    return { error: "No pudimos iniciar el onboarding. Revisá que la migración de preferencias esté aplicada." };
  }

  return { preferences: created };
}

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const [params, result] = await Promise.all([searchParams, getPreferences()]);

  if ("error" in result) {
    return (
      <main className="min-h-screen bg-background px-5 py-8 text-foreground">
        <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <div className="space-y-3">
            <div className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
              Rumbo · Onboarding
            </div>
          </div>
          <Card className="shadow-sm">
            <CardHeader>
              <CardDescription className="font-bold tracking-[0.16em] text-primary uppercase">
                Configuración pendiente
              </CardDescription>
              <CardTitle className="text-3xl">No pudimos preparar tus preferencias</CardTitle>
              <CardDescription>
                El onboarding es obligatorio para entrar a Rumbo, pero la base de datos todavía no respondió con el esquema esperado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error ?? result.error}
              </p>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                Aplicá la migración de preferencias y recargá esta pantalla. Hasta que se complete el onboarding, el resto de la app seguirá bloqueado.
              </p>
            </CardContent>
            <CardFooter>
              <Button className="h-11 rounded-full" render={<a href="/app/onboarding" />}>
                Reintentar
              </Button>
            </CardFooter>
          </Card>
        </section>
      </main>
    );
  }

  const { preferences } = result;

  if (preferences.onboarding_completed_at) {
    redirect("/app");
  }

  const step = isOnboardingStep(preferences.onboarding_step)
    && preferences.onboarding_step !== "complete"
    ? preferences.onboarding_step
    : "interests";
  const copy = stepCopy[step];
  const stepNumber = stepOrder.indexOf(step) + 1;

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-foreground">
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="space-y-3">
          <div className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
            Rumbo · Onboarding
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(stepNumber / stepOrder.length) * 100}%` }}
            />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Paso {stepNumber} de {stepOrder.length}
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardDescription className="font-bold tracking-[0.16em] text-primary uppercase">
              {copy.eyebrow}
            </CardDescription>
            <CardTitle className="text-3xl">{copy.title}</CardTitle>
            <CardDescription>{copy.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {params.error ? (
              <p className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {params.error}
              </p>
            ) : null}

            {step === "interests" ? (
              <form action={saveOnboardingInterests} className="grid gap-5">
                <InterestRequirement />
                <InterestFields selected={preferences.interests} />
                <Button className="h-12 rounded-full" type="submit">
                  {copy.button}
                </Button>
              </form>
            ) : null}

            {step === "pace" ? (
              <form action={saveOnboardingPace} className="grid gap-5">
                <PreferenceHint>Elegí el ritmo que más se parezca a tus viajes ideales.</PreferenceHint>
                <PaceFields selected={preferences.pace} />
                <Button className="h-12 rounded-full" type="submit">
                  {copy.button}
                </Button>
              </form>
            ) : null}

            {step === "prompt" ? (
              <form action={saveOnboardingPrompt} className="grid gap-5">
                <PromptField value={preferences.travel_style_prompt} />
                <Button className="h-12 rounded-full" type="submit">
                  {copy.button}
                </Button>
              </form>
            ) : null}

            {step === "budget" ? (
              <form action={completeOnboardingBudget} className="grid gap-5">
                <PreferenceHint>Elegí un rango. Más adelante lo podés cambiar desde Perfil.</PreferenceHint>
                <BudgetFields selected={preferences.budget} />
                <Button className="h-12 rounded-full" type="submit">
                  {copy.button}
                </Button>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
