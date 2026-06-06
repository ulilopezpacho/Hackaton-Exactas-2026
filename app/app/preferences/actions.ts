"use server";

import { redirect } from "next/navigation";

import {
  minimumInterests,
  nextIncompleteStep,
  readBudget,
  readInterests,
  readPace,
  readPrompt,
} from "@/lib/preferences";
import { createClient } from "@/utils/supabase/server";

const onboardingPath = "/app/onboarding";
const profilePreferencesPath = "/app/profile";

function withError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function getUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return { supabase, userId: user.id };
}

async function getCurrentPreferences(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("budget, interests, onboarding_completed_at, onboarding_step, pace, travel_style_prompt")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

export async function saveOnboardingInterests(formData: FormData) {
  const interests = readInterests(formData);

  if (interests.length < minimumInterests) {
    withError(onboardingPath, `Elegí al menos ${minimumInterests} intereses`);
  }

  const { supabase, userId } = await getUserId();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      interests,
      onboarding_step: "pace",
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    withError(onboardingPath, "No pudimos guardar tus intereses");
  }

  redirect(onboardingPath);
}

export async function saveOnboardingPace(formData: FormData) {
  const pace = readPace(formData);

  if (!pace) {
    withError(onboardingPath, "Elegí un ritmo de viaje");
  }

  const { supabase, userId } = await getUserId();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      onboarding_step: "prompt",
      pace,
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    withError(onboardingPath, "No pudimos guardar tu ritmo");
  }

  redirect(onboardingPath);
}

export async function saveOnboardingPrompt(formData: FormData) {
  const prompt = readPrompt(formData);

  const { supabase, userId } = await getUserId();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      onboarding_step: "budget",
      travel_style_prompt: prompt,
      updated_at: new Date().toISOString(),
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    withError(onboardingPath, "No pudimos guardar tu preferencia");
  }

  redirect(onboardingPath);
}

export async function completeOnboardingBudget(formData: FormData) {
  const budget = readBudget(formData);

  if (!budget) {
    withError(onboardingPath, "Elegí un presupuesto promedio por día");
  }

  const { supabase, userId } = await getUserId();
  const current = await getCurrentPreferences(userId);

  if (!current) {
    withError(onboardingPath, "Primero completá tus intereses");
  }

  const missingStep = nextIncompleteStep({
    ...current,
    budget,
  });

  if (missingStep !== "complete") {
    const { error } = await supabase
      .from("user_preferences")
      .update({ onboarding_step: missingStep, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (error) {
      withError(onboardingPath, "No pudimos retomar el onboarding");
    }

    redirect(onboardingPath);
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("user_preferences")
    .update({
      budget,
      onboarding_completed_at: now,
      onboarding_step: "complete",
      updated_at: now,
    })
    .eq("user_id", userId);

  if (error) {
    withError(onboardingPath, "No pudimos completar el onboarding");
  }

  redirect("/app");
}

export async function saveProfilePreferences(formData: FormData) {
  const interests = readInterests(formData);
  const pace = readPace(formData);
  const prompt = readPrompt(formData);
  const budget = readBudget(formData);

  if (interests.length < minimumInterests) {
    withError(profilePreferencesPath, `Elegí al menos ${minimumInterests} intereses`);
  }

  if (!pace) {
    withError(profilePreferencesPath, "Elegí un ritmo de viaje");
  }

  if (!budget) {
    withError(profilePreferencesPath, "Elegí un presupuesto promedio por día");
  }

  const { supabase, userId } = await getUserId();
  const current = await getCurrentPreferences(userId);
  const now = new Date().toISOString();
  const { error } = await supabase.from("user_preferences").upsert(
    {
      budget,
      interests,
      onboarding_completed_at: current?.onboarding_completed_at ?? now,
      onboarding_step: "complete",
      pace,
      travel_style_prompt: prompt,
      updated_at: now,
      user_id: userId,
    },
    { onConflict: "user_id" },
  );

  if (error) {
    withError(profilePreferencesPath, "No pudimos guardar tus preferencias");
  }

  redirect("/app/profile");
}
