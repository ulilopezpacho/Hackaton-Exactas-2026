export type StoredTripStatus =
  | "planned"
  | "generating"
  | "ongoing"
  | "completed";

export function resolvedTripStatus(
  storedStatus: StoredTripStatus,
  hasItinerary: boolean,
): StoredTripStatus {
  if (storedStatus === "generating" && hasItinerary) {
    return "planned";
  }

  return storedStatus;
}
