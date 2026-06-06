import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/server";

import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b bg-card/80">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4">
          <Link className="font-heading text-xl font-semibold" href="/app">
            Rumbo
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <Link className="text-muted-foreground hover:text-foreground" href="/app/trips">
              Viajes
            </Link>
            <Link className="text-muted-foreground hover:text-foreground" href="/app/profile">
              Perfil
            </Link>
            <form action={signOut}>
              <Button size="sm" type="submit" variant="outline">
                Salir
              </Button>
            </form>
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
