import { redirect } from "next/navigation";

import { AppNavigation } from "@/components/app/app-navigation";
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
      <AppNavigation initial={initial} signOutAction={signOut} />
      {children}
    </main>
  );
}
