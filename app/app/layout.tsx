import Link from "next/link";
import { redirect } from "next/navigation";

import { ProfileMenu } from "@/components/app/profile-menu";
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

  const profileName = String(user.user_metadata.name ?? user.user_metadata.full_name ?? user.email ?? "R");
  const initial = profileName.trim().charAt(0).toUpperCase() || "R";

  return (
    <main className="app-shell min-h-screen bg-background text-foreground">
      <header className="app-header sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
          <Link className="text-lg font-bold tracking-[-0.03em]" href="/app">
            Rumbo
          </Link>
          <nav className="flex items-center gap-3 text-sm font-medium">
            <ProfileMenu initial={initial} signOutAction={signOut} />
          </nav>
        </div>
      </header>
      {children}
    </main>
  );
}
