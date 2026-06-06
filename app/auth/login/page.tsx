import { AuthForm } from "@/components/auth/auth-form";

import { login } from "../actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return (
    <AuthForm
      action={login}
      alternateHref="/auth/sign-up"
      alternateLabel="Crear una cuenta"
      buttonLabel="Entrar"
      description="Entrá con tu email para seguir armando tus viajes."
      error={params.error}
      message={params.message}
      next={params.next}
      title="Login"
    />
  );
}
