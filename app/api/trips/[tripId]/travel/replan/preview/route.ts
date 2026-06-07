import { getTrip } from "@/lib/trips/data";

type PreviewRequest = {
  scenario?: "closed" | "overstay";
  strategy?: "trim" | "recalculate" | "recommended" | "solver";
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

  if (!["trim", "recalculate", "recommended", "solver"].includes(strategy)) {
    return Response.json({ error: "Unsupported strategy" }, { status: 400 });
  }

  if (strategy === "solver") {
    return Response.json({
      explanation:
        "Se reoptimiza la ruta completa para los días restantes usando el solver. Los lugares ya visitados se conservan.",
      operations: [],
      scenario,
      strategy,
    });
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

  if (strategy === "recalculate") {
    const dropItem = upcoming.at(-1);
    const operations = dropItem
      ? [
          {
            enabled: true,
            id: `remove-${dropItem.id}`,
            itemId: dropItem.id,
            label: `Quitar ${dropItem.place?.name ?? dropItem.title}`,
            type: "remove" as const,
          },
        ]
      : [];

    return Response.json({
      explanation: operations.length
        ? "Quitás el último punto pendiente para liberar tiempo sin tocar el punto actual."
        : "No quedan puntos pendientes para recalcular.",
      operations,
      scenario,
      strategy,
    });
  }

  const operations =
    scenario === "closed"
      ? upcoming.slice(0, 1).map((item) => ({
          enabled: true,
          id: `remove-${item.id}`,
          itemId: item.id,
          label: `Quitar ${item.place?.name ?? item.title}`,
          type: "remove" as const,
        }))
      : upcoming.slice(0, 2).map(trimOperation);

  return Response.json({
    explanation:
      scenario === "closed"
        ? operations.length
          ? "Conviene quitar el próximo punto cerrado y conservar el resto del día."
          : "No quedan puntos pendientes para reemplazar."
        : operations.length
          ? "Conviene recortar los próximos puntos para recuperar el atraso sin perder el recorrido."
          : "No quedan puntos pendientes que necesiten ajustes.",
    operations,
    scenario,
    strategy,
  });
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
