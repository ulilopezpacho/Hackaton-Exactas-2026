export const interestOptions = [
  "Arte",
  "Historia",
  "Gastronomía",
  "Aire libre",
  "Vistas",
  "Paseo",
  "Clásico",
  "Fútbol",
  "Música",
  "Deporte",
  "Otros",
] as const;

export const paceOptions = [
  {
    value: "relaxed",
    label: "Relajado",
    description: "Pocas paradas y tiempo para perderse.",
  },
  {
    value: "balanced",
    label: "Equilibrado",
    description: "Un buen mix entre planes y aire libre.",
  },
  {
    value: "intense",
    label: "Intenso",
    description: "Aprovechar el día al máximo.",
  },
] as const;

export const budgetOptions = [
  {
    value: "under_50",
    label: "Hasta USD 50/día",
    description: "Opciones simples y muy cuidadas.",
  },
  {
    value: "50_100",
    label: "USD 50-100/día",
    description: "Cómodo sin irse de presupuesto.",
  },
  {
    value: "100_200",
    label: "USD 100-200/día",
    description: "Más margen para experiencias especiales.",
  },
  {
    value: "over_200",
    label: "USD 200+/día",
    description: "Prioridad en calidad y conveniencia.",
  },
] as const;

export const onboardingSteps = ["interests", "pace", "prompt", "budget", "complete"] as const;

export type Interest = (typeof interestOptions)[number];
export type Pace = (typeof paceOptions)[number]["value"];
export type Budget = (typeof budgetOptions)[number]["value"];
export type OnboardingStep = (typeof onboardingSteps)[number];

export const minimumInterests = 3;

export function isInterest(value: string): value is Interest {
  return interestOptions.includes(value as Interest);
}

export function isPace(value: string): value is Pace {
  return paceOptions.some((option) => option.value === value);
}

export function isBudget(value: string): value is Budget {
  return budgetOptions.some((option) => option.value === value);
}

export function isOnboardingStep(value: string): value is OnboardingStep {
  return onboardingSteps.includes(value as OnboardingStep);
}

export function readInterests(formData: FormData) {
  return formData.getAll("interests").map(String).filter(isInterest);
}

export function readPace(formData: FormData) {
  const value = String(formData.get("pace") ?? "");
  return isPace(value) ? value : null;
}

export function readBudget(formData: FormData) {
  const value = String(formData.get("budget") ?? "");
  return isBudget(value) ? value : null;
}

export function readPrompt(formData: FormData) {
  const value = String(formData.get("travel_style_prompt") ?? "").trim();
  return value || null;
}

export function formatPace(value: Pace | null) {
  return paceOptions.find((option) => option.value === value)?.label ?? "Sin definir";
}

export function formatBudget(value: Budget | null) {
  return budgetOptions.find((option) => option.value === value)?.label ?? "Sin definir";
}

export function nextIncompleteStep(preferences: {
  budget: Budget | null;
  interests: string[];
  onboarding_completed_at: string | null;
  pace: Pace | null;
  travel_style_prompt: string | null;
}) {
  if (preferences.onboarding_completed_at) {
    return "complete";
  }

  if (preferences.interests.filter(isInterest).length < minimumInterests) {
    return "interests";
  }

  if (!preferences.pace) {
    return "pace";
  }

  if (!preferences.budget) {
    return "budget";
  }

  return "complete";
}
