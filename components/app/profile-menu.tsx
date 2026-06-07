"use client";

import Link from "next/link";
import { useState } from "react";

type ProfileMenuProps = {
  initial: string;
  signOutAction: () => Promise<void>;
};

export function ProfileMenu({ initial, signOutAction }: ProfileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        aria-expanded={open}
        aria-label="Abrir perfil"
        className="grid size-10 place-items-center rounded-[10px] bg-primary text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-none"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {initial}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-3 w-44 overflow-hidden rounded-xl border border-border bg-card py-2 text-sm font-medium shadow-lg shadow-foreground/8">
          <Link
            className="block px-4 py-2.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            href="/app/profile"
            onClick={() => setOpen(false)}
          >
            Preferencias
          </Link>
          <form action={signOutAction}>
            <button
              className="block w-full px-4 py-2.5 text-left text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              type="submit"
            >
              Salir
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
