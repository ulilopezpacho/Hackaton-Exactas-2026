const DAY_MS = 24 * 60 * 60 * 1000;

export type TripDateRange = {
  startsOn: string;
  endsOn: string;
  dayCount: number;
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

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Elegí una fecha válida.");
  }

  return date;
}
