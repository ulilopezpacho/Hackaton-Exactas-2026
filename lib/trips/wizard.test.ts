import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSequentialItineraryItems,
  parseTripDates,
  type WizardPlaceDraft,
} from "./wizard.ts";

test("parseTripDates accepts an inclusive date range", () => {
  const range = parseTripDates("2026-06-12", "2026-06-14");

  assert.deepEqual(range, {
    startsOn: "2026-06-12",
    endsOn: "2026-06-14",
    dayCount: 3,
  });
});

test("parseTripDates rejects inverted or missing dates", () => {
  assert.throws(() => parseTripDates("", "2026-06-14"), /Elegí fecha/);
  assert.throws(
    () => parseTripDates("2026-06-15", "2026-06-14"),
    /posterior/,
  );
});

test("buildSequentialItineraryItems distributes places across days and keeps order", () => {
  const places: WizardPlaceDraft[] = [
    { name: "Palacio Real", durationMinutes: 120 },
    { name: "Museo del Prado", durationMinutes: 180 },
    { name: "Parque del Retiro", durationMinutes: 90 },
    { name: "Templo de Debod", durationMinutes: 60 },
  ];

  const items = buildSequentialItineraryItems({
    startsOn: "2026-06-12",
    endsOn: "2026-06-13",
    dayCount: 2,
    places,
  });

  assert.deepEqual(
    items.map(({ title, dayNumber, startsAt, endsAt, position }) => ({
      title,
      dayNumber,
      startsAt,
      endsAt,
      position,
    })),
    [
      {
        title: "Palacio Real",
        dayNumber: 1,
        startsAt: "2026-06-12T10:00:00.000Z",
        endsAt: "2026-06-12T12:00:00.000Z",
        position: 0,
      },
      {
        title: "Museo del Prado",
        dayNumber: 1,
        startsAt: "2026-06-12T12:30:00.000Z",
        endsAt: "2026-06-12T15:30:00.000Z",
        position: 1,
      },
      {
        title: "Parque del Retiro",
        dayNumber: 2,
        startsAt: "2026-06-13T10:00:00.000Z",
        endsAt: "2026-06-13T11:30:00.000Z",
        position: 2,
      },
      {
        title: "Templo de Debod",
        dayNumber: 2,
        startsAt: "2026-06-13T12:00:00.000Z",
        endsAt: "2026-06-13T13:00:00.000Z",
        position: 3,
      },
    ],
  );
});
