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

function normalizeInterest(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, "");
}
