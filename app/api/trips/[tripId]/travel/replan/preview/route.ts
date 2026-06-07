import { getTrip } from "@/lib/trips/data";
import { replanWithSolver } from "@/lib/itinerary/replan-solver";

type PreviewRequest = {
  scenario?: "closed" | "overstay";
  strategy?: "trim" | "recalculate" | "recommended";
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as PreviewRequest;
  const scenario = body.scenario ?? "overstay";
  const strategy = body.strategy ?? "recommended";
  const trip = await getTrip(tripId);

  if (!["trim", "recalculate", "recommended"].includes(strategy)) {
    return Response.json({ error: "Unsupported strategy" }, { status: 400 });
  }

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
  const upcoming = navigableItems.slice(Math.max(0, currentIndex + 1));

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

  if (strategy === "recalculate" || strategy === "recommended") {
    try {
      const nextPlaceItem = upcoming.find(
        (item) => item.itemType === "place" && item.place?.id,
      );
      const excludePlaceIds: string[] = [];
      if (scenario === "closed" && nextPlaceItem?.place?.id) {
        excludePlaceIds.push(nextPlaceItem.place.id);
      }

      const solverResult = await replanWithSolver({
        tripId,
        currentItemId: trip.currentItineraryItemId!,
        currentDayNumber: trip.currentDayNumber!,
        excludePlaceIds,
      });

      const operations: Array<{
        durationMinutes?: number;
        enabled: boolean;
        id: string;
        itemId: string;
        label: string;
        previousDurationMinutes?: number;
        type: "remove" | "trim";
      }> = [];

      // 1. If closed place scenario, add explicit remove operation for the closed place
      if (scenario === "closed" && nextPlaceItem) {
        operations.push({
          enabled: true,
          id: `remove-${nextPlaceItem.id}`,
          itemId: nextPlaceItem.id,
          label: `Quitar ${nextPlaceItem.place?.name ?? nextPlaceItem.title} (cerrado)`,
          type: "remove" as const,
        });
      }

      // 2. Dropped places -> remove operations
      for (const placeId of solverResult.droppedPlaceIds) {
        // Skip if already added as closed place
        if (scenario === "closed" && nextPlaceItem?.place?.id === placeId) continue;

        const item = upcoming.find((i) => i.place?.id === placeId);
        if (item) {
          operations.push({
            enabled: true,
            id: `remove-${item.id}`,
            itemId: item.id,
            label: `Quitar ${item.place?.name ?? item.title} (no entra)`,
            type: "remove" as const,
          });
        }
      }

      // 3. Durations changed -> trim operations
      for (const newItem of solverResult.newItems) {
        if (!newItem.placeId || newItem.itemType !== "place") continue;
        const item = upcoming.find((i) => i.place?.id === newItem.placeId);
        if (item) {
          const newDuration = Math.round(
            (new Date(newItem.endsAt).getTime() - new Date(newItem.startsAt).getTime()) / 60000,
          );
          if (newDuration < item.durationMinutes) {
            operations.push({
              durationMinutes: newDuration,
              enabled: true,
              id: `trim-${item.id}`,
              itemId: item.id,
              label: `Acortar ${item.place?.name ?? item.title}`,
              previousDurationMinutes: item.durationMinutes,
              type: "trim" as const,
            });
          }
        }
      }

      let explanation = "";
      if (strategy === "recalculate") {
        if (solverResult.droppedPlaceIds.length > 0) {
          explanation = `Recalculamos el itinerario. Tuvimos que quitar ${solverResult.droppedPlaceIds.length} lugar(es) que no cabían en el tiempo disponible.`;
        } else {
          explanation = "Recalculamos el itinerario de forma inteligente. Logramos reordenar y conservar todos tus lugares pendientes.";
        }
      } else {
        if (solverResult.droppedPlaceIds.length > 0) {
          explanation = `Optimizamos tu día de forma inteligente. Tuvimos que quitar ${solverResult.droppedPlaceIds.length} lugar(es) que no llegaban a entrar en el horario.`;
        } else {
          explanation = "¡Buenas noticias! El optimizador inteligente logró reordenar todos tus lugares pendientes para que no te pierdas nada.";
        }
      }

      if (scenario === "closed" && nextPlaceItem) {
        explanation = `Como ${nextPlaceItem.place?.name ?? nextPlaceItem.title} cerró, ` + explanation.toLowerCase();
        explanation = explanation.charAt(0).toUpperCase() + explanation.slice(1);
      }

      return Response.json({
        explanation,
        operations,
        scenario,
        strategy,
      });
    } catch (err) {
      console.error("[replan-preview] Solver error:", err);
      return Response.json({
        explanation: "No se pudo calcular la recomendación inteligente.",
        operations: [],
        scenario,
        strategy,
      });
    }
  }
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
