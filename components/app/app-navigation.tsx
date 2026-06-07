"use client";

import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ProfileMenu } from "@/components/app/profile-menu";

export function AppNavigation({
  initial,
  signOutAction,
}: {
  initial: string;
  signOutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const isHome = pathname === "/app";

  if (!isHome) {
    return (
      <div className="mx-auto w-full max-w-6xl px-5 pt-5">
        <Button
          aria-label="Volver al inicio"
          className="rounded-full"
          nativeButton={false}
          render={<Link href="/app" />}
          size="icon"
          variant="outline"
        >
          <ChevronLeftIcon />
        </Button>
      </div>
    );
  }

  return (
    <header className="app-header sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-md">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
        <Link className="text-lg font-bold tracking-[-0.03em]" href="/app">
          Rumbo
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium">
          <ProfileMenu initial={initial} signOutAction={signOutAction} />
        </nav>
      </div>
    </header>
  );
}
