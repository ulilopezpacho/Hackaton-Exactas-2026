import type { ComponentPropsWithoutRef, ReactNode } from "react";

import {
  budgetOptions,
  interestOptions,
  minimumInterests,
  paceOptions,
  type Budget,
  type Interest,
  type Pace,
} from "@/lib/preferences";
import { cn } from "@/lib/utils";

type OptionCardProps = ComponentPropsWithoutRef<"input"> & {
  description: string;
  label: string;
};

function SelectableCard({ className, description, label, ...props }: OptionCardProps) {
  return (
    <label className="group relative block cursor-pointer">
      <input className="peer sr-only" {...props} />
      <span
        className={cn(
          "flex min-h-24 flex-col justify-between rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm transition peer-checked:border-primary peer-checked:bg-primary/10 peer-focus-visible:ring-3 peer-focus-visible:ring-ring/40",
          className,
        )}
      >
        <span className="text-lg leading-tight font-semibold">{label}</span>
        <span className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function InterestFields({ selected = [] }: { selected?: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {interestOptions.map((interest) => (
        <label key={interest} className="cursor-pointer">
          <input
            className="peer sr-only"
            defaultChecked={selected.includes(interest)}
            name="interests"
            type="checkbox"
            value={interest}
          />
          <span className="inline-flex min-h-11 items-center rounded-[10px] border border-border bg-card px-4 text-sm font-semibold transition-colors peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/30">
            {interest}
          </span>
        </label>
      ))}
    </div>
  );
}

export function PaceFields({ selected }: { selected?: Pace | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {paceOptions.map((option) => (
        <SelectableCard
          key={option.value}
          defaultChecked={selected === option.value}
          description={option.description}
          label={option.label}
          name="pace"
          type="radio"
          value={option.value}
        />
      ))}
    </div>
  );
}

export function BudgetFields({ selected }: { selected?: Budget | null }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {budgetOptions.map((option) => (
        <SelectableCard
          key={option.value}
          defaultChecked={selected === option.value}
          description={option.description}
          label={option.label}
          name="budget"
          type="radio"
          value={option.value}
        />
      ))}
    </div>
  );
}

export function PromptField({ value }: { value?: string | null }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      Contanos cómo te gusta viajar (opcional)
      <textarea
        className="min-h-36 w-full resize-none rounded-xl border border-input bg-card px-4 py-3 text-base leading-relaxed outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 md:text-sm"
        defaultValue={value ?? ""}
        name="travel_style_prompt"
        placeholder="Ej: Me gusta caminar, prefiero museos a shopping, dejo tiempo para cafés y no quiero correr de un lugar a otro."
      />
    </label>
  );
}

export function PreferenceHint({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted-foreground">{children}</p>;
}

export function InterestRequirement() {
  return (
    <PreferenceHint>
      Elegí al menos {minimumInterests}. Después usamos esto para ordenar lugares y sugerencias.
    </PreferenceHint>
  );
}

export type { Budget, Interest, Pace };
