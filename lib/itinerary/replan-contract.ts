export type ReplanScenario = "closed" | "overstay";
export type ReplanStrategy = "recalculate" | "recommended" | "trim";

export type ReplanConstraints = {
  currentItemId: string;
  durationMinutesByItemId: Record<string, number>;
  effectiveStartAt: string;
  excludedPlaceIds: string[];
  sourceItineraryId: string;
};

export type ReplanDisplayOperation = {
  id: string;
  itemId: string;
  label: string;
  type: "remove";
};

export type ReplanPreview = {
  constraints: ReplanConstraints;
  explanation: string;
  operations: ReplanDisplayOperation[];
  scenario: ReplanScenario;
  strategy: Exclude<ReplanStrategy, "trim">;
};

export type ReplanConstraintItem = {
  durationMinutes: number;
  endsAt: string;
  id: string;
  itemType: string;
  placeId: string | null;
};

export function addMinutes(iso: string, minutes: number) {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

export function buildReplanConstraints(input: {
  currentItem: ReplanConstraintItem;
  scenario: ReplanScenario;
  sourceItineraryId: string;
  upcomingItems: ReplanConstraintItem[];
}): ReplanConstraints {
  const closedItem =
    input.scenario === "closed"
      ? input.upcomingItems.find(
          (item) => item.itemType === "place" && item.placeId,
        )
      : null;

  return {
    currentItemId: input.currentItem.id,
    durationMinutesByItemId: Object.fromEntries(
      input.upcomingItems.map((item) => [item.id, item.durationMinutes]),
    ),
    effectiveStartAt:
      input.scenario === "overstay"
        ? addMinutes(input.currentItem.endsAt, 30)
        : input.currentItem.endsAt,
    excludedPlaceIds: closedItem?.placeId ? [closedItem.placeId] : [],
    sourceItineraryId: input.sourceItineraryId,
  };
}

export function isReplanConstraints(value: unknown): value is ReplanConstraints {
  if (!value || typeof value !== "object") {
    return false;
  }

  const constraints = value as Partial<ReplanConstraints>;
  const durations =
    constraints.durationMinutesByItemId &&
    typeof constraints.durationMinutesByItemId === "object"
      ? Object.values(constraints.durationMinutesByItemId)
      : [];
  return (
    typeof constraints.currentItemId === "string" &&
    typeof constraints.effectiveStartAt === "string" &&
    Number.isFinite(Date.parse(constraints.effectiveStartAt)) &&
    typeof constraints.sourceItineraryId === "string" &&
    Array.isArray(constraints.excludedPlaceIds) &&
    constraints.excludedPlaceIds.every((id) => typeof id === "string") &&
    Boolean(constraints.durationMinutesByItemId) &&
    durations.every(
      (duration) =>
        typeof duration === "number" &&
        Number.isFinite(duration) &&
        duration > 0,
    )
  );
}
