const MAX_EXTRACTED_INTERESTS = 12;

export function sanitizeExtractedInterests(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return mergeSearchInterests(
    [],
    value.filter((item): item is string => typeof item === "string"),
  ).slice(0, MAX_EXTRACTED_INTERESTS);
}

export function mergeSearchInterests(
  savedInterests: string[],
  extractedInterests: string[],
): string[] {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const interest of [...savedInterests, ...extractedInterests]) {
    const cleaned = interest.trim().replace(/\s+/g, " ").slice(0, 100);
    const key = normalizeInterest(cleaned);

    if (!cleaned || !key || seen.has(key)) continue;

    seen.add(key);
    merged.push(cleaned);
  }

  return merged;
}

export function normalizeInterest(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Splits the catalog `categories` into the subset worth keeping given the
 * extracted `interests`:
 * - `meal`: any category whose normalized form contains a meal keyword. These
 *   are always kept so the solver has somewhere to schedule meals.
 * - `activity`: a non-meal category is kept when its normalized form contains,
 *   or is contained by, any normalized interest.
 *
 * Matching is accent- and case-insensitive (via `normalizeInterest`). Pure and
 * synchronous so it can be unit-tested without DB/LLM access.
 */
export function matchCatalogCategories(
  categories: string[],
  interests: string[],
  mealKeywords: string[],
): { activity: string[]; meal: string[] } {
  const normInterests = interests
    .map(normalizeInterest)
    .filter((i) => i.length > 0);
  const normMealKeywords = mealKeywords
    .map(normalizeInterest)
    .filter((k) => k.length > 0);

  const activity: string[] = [];
  const meal: string[] = [];

  for (const category of categories) {
    const normCategory = normalizeInterest(category);
    if (!normCategory) continue;

    if (normMealKeywords.some((k) => normCategory.includes(k))) {
      meal.push(category);
      continue;
    }

    const matches = normInterests.some(
      (i) => i.includes(normCategory) || normCategory.includes(i),
    );
    if (matches) activity.push(category);
  }

  return { activity, meal };
}
