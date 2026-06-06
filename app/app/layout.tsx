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
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border/70 bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center justify-between gap-4 px-5 py-2.5">
          <Link className="font-heading text-lg font-semibold" href="/app">
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
