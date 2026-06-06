import "server-only";

type VersionedItinerary = {
  created_at: string;
  day_number: number;
  generated_from_itinerary_id: string | null;
  id: string;
  itinerary_type: string | null;
  status: string;
};

export function selectCurrentItineraryLeaves<T extends VersionedItinerary>(
  itineraries: T[],
) {
  const itineraryIds = new Set(itineraries.map((itinerary) => itinerary.id));
  const ancestorIds = new Set(
    itineraries.flatMap((itinerary) => {
      const ancestorId = itinerary.generated_from_itinerary_id;
      return ancestorId && itineraryIds.has(ancestorId) ? [ancestorId] : [];
    }),
  );
  const latestByDayAndType = new Map<string, T>();

  for (const itinerary of itineraries) {
    if (itinerary.status === "draft" || ancestorIds.has(itinerary.id)) {
      continue;
    }

    const key = `${itinerary.day_number}:${itinerary.itinerary_type ?? "default"}`;
    const current = latestByDayAndType.get(key);

    if (!current || itinerary.created_at > current.created_at) {
      latestByDayAndType.set(key, itinerary);
    }
  }

  return Array.from(latestByDayAndType.values()).toSorted(
    (first, second) =>
      first.day_number - second.day_number ||
      first.created_at.localeCompare(second.created_at),
  );
}
