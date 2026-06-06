import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AuthFormProps = {
  action: (formData: FormData) => Promise<void>;
  alternateHref: string;
  alternateLabel: string;
  buttonLabel: string;
  description: string;
  error?: string;
  message?: string;
  next?: string;
  title: string;
};

export function AuthForm({
  action,
  alternateHref,
  alternateLabel,
  buttonLabel,
  description,
  error,
  message,
  next = "/app",
  title,
}: AuthFormProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-5 py-10 text-foreground">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-col gap-4">
            <input name="next" type="hidden" value={next} />
            <label className="grid gap-2 text-sm font-medium">
              Email
              <Input
                autoComplete="email"
                className="h-11"
                name="email"
                placeholder="uli@example.com"
                required
                type="email"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Contraseña
              <Input
                autoComplete="current-password"
                className="h-11"
                minLength={6}
                name="password"
                required
                type="password"
              />
            </label>
            {error ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}
            {message ? (
              <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
                {message}
              </p>
            ) : null}
            <Button className="h-11 w-full" type="submit">
              {buttonLabel}
            </Button>
          </form>
          <Link
            className="mt-4 block text-center text-sm font-medium text-primary hover:underline"
            href={alternateHref}
          >
            {alternateLabel}
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
