"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/utils/supabase/server";

function getAuthFields(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/app");

  if (!email || !password) {
    redirect("/auth/login?error=Completá email y contraseña");
  }

  if (password.length < 6) {
    redirect("/auth/sign-up?error=La contraseña debe tener al menos 6 caracteres");
  }

  return { email, password, next: next.startsWith("/") ? next : "/app" };
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const { email, password, next } = getAuthFields(formData);
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/auth/login?error=${encodeURIComponent(error.message)}`);
  }

  redirect(next);
}

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const { email, password } = getAuthFields(formData);
  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=/app`,
    },
  });

  if (error) {
    redirect(`/auth/sign-up?error=${encodeURIComponent(error.message)}`);
  }

  if (data.session) {
    redirect("/app");
  }

  redirect("/auth/login?message=Revisá tu email para confirmar la cuenta");
}
