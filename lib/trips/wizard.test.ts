import assert from "node:assert/strict";
import test from "node:test";

import { parseTripDates } from "./wizard.ts";

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
