const DAY_MS = 24 * 60 * 60 * 1000;
const START_HOUR_UTC = 10;
const TRANSFER_MINUTES = 30;

export type TripDateRange = {
  startsOn: string;
  endsOn: string;
  dayCount: number;
};

export type WizardPlaceDraft = {
  name: string;
  durationMinutes: number;
  placeId?: string;
};

export type SequentialItineraryItem = {
  dayNumber: number;
  endsAt: string;
  placeDraft: WizardPlaceDraft;
  position: number;
  startsAt: string;
  title: string;
};

export function parseTripDates(startsOn: string, endsOn: string): TripDateRange {
  if (!startsOn || !endsOn) {
    throw new Error("Elegí fecha de llegada y salida.");
  }

  const start = parseDateOnly(startsOn);
  const end = parseDateOnly(endsOn);

  if (end.getTime() < start.getTime()) {
    throw new Error("La fecha de salida debe ser posterior a la llegada.");
  }

  return {
    startsOn,
    endsOn,
    dayCount: Math.floor((end.getTime() - start.getTime()) / DAY_MS) + 1,
  };
}

export function buildSequentialItineraryItems({
  startsOn,
  dayCount,
  places,
}: TripDateRange & {
  places: WizardPlaceDraft[];
}): SequentialItineraryItem[] {
  const tripStart = parseDateOnly(startsOn);
  const days = Array.from({ length: dayCount }, (_, index) =>
    Date.UTC(
      tripStart.getUTCFullYear(),
      tripStart.getUTCMonth(),
      tripStart.getUTCDate() + index,
      START_HOUR_UTC,
    ),
  );

  return places.map((placeDraft, position) => {
    const dayIndex = Math.min(
      Math.floor((position * dayCount) / Math.max(places.length, 1)),
      dayCount - 1,
    );
    const startsAt = days[dayIndex];
    const endsAt = startsAt + placeDraft.durationMinutes * 60 * 1000;
    days[dayIndex] = endsAt + TRANSFER_MINUTES * 60 * 1000;

    return {
      dayNumber: dayIndex + 1,
      endsAt: new Date(endsAt).toISOString(),
      placeDraft,
      position,
      startsAt: new Date(startsAt).toISOString(),
      title: placeDraft.name,
    };
  });
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Elegí una fecha válida.");
  }

  return date;
}
