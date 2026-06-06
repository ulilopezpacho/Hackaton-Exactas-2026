import { AuthForm } from "@/components/auth/auth-form";

import { signUp } from "../actions";

type SignUpPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;

  return (
    <AuthForm
      action={signUp}
      alternateHref="/auth/login"
      alternateLabel="Ya tengo cuenta"
      buttonLabel="Crear cuenta"
      description="Creá tu usuario para guardar viajes e itinerarios."
      error={params.error}
      next={params.next}
      title="Sign up"
    />
  );
}
