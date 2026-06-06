import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PageShellProps = {
  actions?: ReactNode;
  children: ReactNode;
  eyebrow?: string;
  title: string;
};

export function PageShell({ actions, children, eyebrow, title }: PageShellProps) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          {eyebrow ? <Badge variant="secondary">{eyebrow}</Badge> : null}
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

type WorkCardProps = {
  href: string;
  owner: string;
  status?: string;
  title: string;
  description: string;
};

export function WorkCard({
  description,
  href,
  owner,
  status = "Disponible",
  title,
}: WorkCardProps) {
  return (
    <Link className="block" href={href}>
      <Card className="h-full transition hover:-translate-y-0.5 hover:ring-primary/40">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <CardTitle>{title}</CardTitle>
            <Badge variant="outline">{status}</Badge>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Owner sugerido: {owner}
        </CardContent>
      </Card>
    </Link>
  );
}

export function WorkGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>
      {children}
    </div>
  );
}
