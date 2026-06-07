import {
  buildReplanConstraints,
  type ReplanConstraints,
  type ReplanPreview,
  type ReplanScenario,
  type ReplanStrategy,
} from "@/lib/itinerary/replan-contract";
import { replanWithSolver } from "@/lib/itinerary/replan-solver";
import { getTrip } from "@/lib/trips/data";

type PreviewRequest = {
  scenario?: ReplanScenario;
  strategy?: ReplanStrategy;
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as PreviewRequest;
  const scenario = body.scenario ?? "overstay";
  const strategy = body.strategy ?? "recommended";

  if (!["trim", "recalculate", "recommended"].includes(strategy)) {
    return Response.json({ error: "Unsupported strategy" }, { status: 400 });
  }
  if (!["closed", "overstay"].includes(scenario)) {
    return Response.json({ error: "Unsupported scenario" }, { status: 400 });
  }

  const trip = await getTrip(tripId);
  if (!trip || !trip.isOwner) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  const day = trip.days.find(
    (candidate) => candidate.dayNumber === trip.currentDayNumber,
  );
  const navigableItems =
    day?.items.filter(
      (item) =>
        item.itemType === "place" || item.itemType === "recommendation",
    ) ?? [];
  const currentIndex = navigableItems.findIndex(
    (item) => item.id === trip.currentItineraryItemId,
  );

  if (!day || currentIndex < 0) {
    return Response.json(
      { error: "Current itinerary changed; reload travel mode" },
      { status: 409 },
    );
  }

  const currentItem = navigableItems[currentIndex];
  const upcoming = navigableItems.slice(currentIndex + 1);

  if (strategy === "trim") {
    const operations = upcoming.map((item) => trimOperation(item));
    return Response.json({
      explanation: operations.length
        ? "Mantenés todos los puntos pendientes y recortás sus tiempos para recuperar margen."
        : "No quedan puntos pendientes para recortar.",
      operations,
      scenario,
      strategy,
    });
  }

  const closedItem =
    scenario === "closed"
      ? upcoming.find((item) => item.itemType === "place" && item.place)
      : null;
  const constraints: ReplanConstraints = buildReplanConstraints({
    currentItem: {
      durationMinutes: currentItem.durationMinutes,
      endsAt: currentItem.endsAt,
      id: currentItem.id,
      itemType: currentItem.itemType,
      placeId: currentItem.place?.id ?? null,
    },
    scenario,
    sourceItineraryId: day.id,
    upcomingItems: upcoming.map((item) => ({
      durationMinutes: item.durationMinutes,
      endsAt: item.endsAt,
      id: item.id,
      itemType: item.itemType,
      placeId: item.place?.id ?? null,
    })),
  });

  try {
    const result = await replanWithSolver(tripId, constraints);
    const droppedItems = upcoming.filter(
      (item) =>
        item.place &&
        (constraints.excludedPlaceIds.includes(item.place.id) ||
          result.droppedPlaceIds.includes(item.place.id)),
    );
    const preview: ReplanPreview = {
      constraints,
      explanation: buildExplanation({
        closedItemName: closedItem
          ? closedItem.place?.name ?? closedItem.title
          : null,
        droppedCount: droppedItems.length,
        scenario,
      }),
      operations: droppedItems.map((item) => ({
        id: `remove-${item.id}`,
        itemId: item.id,
        label: `Quitar ${item.place?.name ?? item.title}`,
        type: "remove",
      })),
      scenario,
      strategy,
    };
    return Response.json(preview);
  } catch (error) {
    console.error("[replan-preview]", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Replan failed" },
      { status: 500 },
    );
  }
}

function buildExplanation(input: {
  closedItemName: string | null;
  droppedCount: number;
  scenario: ReplanScenario;
}) {
  const prefix = input.closedItemName
    ? `Como ${input.closedItemName} cerró, `
    : "Tomando 30 minutos adicionales, ";
  return input.droppedCount
    ? `${prefix}reordenamos el resto del día y quitamos ${input.droppedCount} punto(s) que ya no entran.`
    : `${prefix}reordenamos el resto del día conservando todos los lugares.`;
}

function trimOperation(item: {
  durationMinutes: number;
  id: string;
  place: { name: string } | null;
  title: string;
}) {
  return {
    durationMinutes: Math.max(
      1,
      Math.min(
        item.durationMinutes,
        Math.max(30, Math.round(item.durationMinutes * 0.7)),
      ),
    ),
    enabled: true,
    id: `trim-${item.id}`,
    itemId: item.id,
    label: `Acortar ${item.place?.name ?? item.title}`,
    previousDurationMinutes: item.durationMinutes,
    type: "trim" as const,
  };
}
