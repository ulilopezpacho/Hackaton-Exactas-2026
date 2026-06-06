import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCuratedPlaces,
  computePopularity,
  computeQualityScore,
  normalizeName,
  type CuratedPlace,
} from "./catalog.ts";
import type { PlaceCandidate } from "./google.ts";

// --- computeQualityScore (Bayesian shrinkage) -----------------------------

test("computeQualityScore returns undefined when rating or total is missing", () => {
  assert.equal(computeQualityScore(undefined, 100), undefined);
  assert.equal(computeQualityScore(4.5, undefined), undefined);
  assert.equal(computeQualityScore(undefined, undefined), undefined);
});

test("computeQualityScore shrinks toward the 3.5 prior for few reviews", () => {
  // With 0 reviews the score is exactly the prior C = 3.5.
  assert.equal(computeQualityScore(5, 0), 3.5);
});

test("computeQualityScore approaches the true rating as reviews grow", () => {
  const lowN = computeQualityScore(5, 10)!;
  const highN = computeQualityScore(5, 10000)!;
  // More reviews => less shrinkage => closer to 5.
  assert.ok(lowN < highN);
  assert.ok(highN > 4.9 && highN <= 5);
  // m = 50, C = 3.5: rating 5 with 50 reviews sits exactly halfway to 5.
  assert.equal(computeQualityScore(5, 50), 4.25);
});

// --- computePopularity (log-dampened) -------------------------------------

test("computePopularity is undefined without a total", () => {
  assert.equal(computePopularity(undefined), undefined);
});

test("computePopularity is log10(total + 1)", () => {
  assert.equal(computePopularity(0), 0);
  assert.equal(computePopularity(9), 1);
  assert.equal(computePopularity(999), 3);
});

// --- normalizeName --------------------------------------------------------

test("normalizeName lowercases, strips diacritics and non-alphanumerics", () => {
  assert.equal(normalizeName("Café René!"), "caferene");
  assert.equal(normalizeName("MUSÉE d'Orsay"), "museedorsay");
  assert.equal(normalizeName("  Plaza Mayor  "), "plazamayor");
});

test("normalizeName handles undefined/empty", () => {
  assert.equal(normalizeName(undefined), "");
  assert.equal(normalizeName(""), "");
  assert.equal(normalizeName("¡!"), "");
});

test("normalizeName collapses names that differ only by punctuation/accents", () => {
  assert.equal(normalizeName("Sagrada Família"), normalizeName("sagrada familia"));
});

// --- buildCuratedPlaces ---------------------------------------------------

function candidate(over: Partial<PlaceCandidate> & { externalId: string; name: string }): PlaceCandidate {
  return {
    address: "Somewhere",
    lat: 1,
    lng: 2,
    primaryType: "museum",
    types: ["museum", "tourist_attraction"],
    summary: "A summary.",
    rating: 4.6,
    userRatingsTotal: 1200,
    ...over,
  };
}

function selection(over: Partial<CuratedPlace> & { externalId: string; name: string }): CuratedPlace {
  return {
    description: "Model-written neutral description.",
    category: "culture",
    address: "model address",
    lat: 0,
    lng: 0,
    ...over,
  };
}

test("buildCuratedPlaces joins authoritative metadata on exact externalId match", () => {
  const found = new Map<string, PlaceCandidate>([
    ["ChIJ_real", candidate({ externalId: "ChIJ_real", name: "Prado Museum" })],
  ]);

  const { curated, dropped } = buildCuratedPlaces(
    [selection({ externalId: "ChIJ_real", name: "Prado Museum" })],
    found,
  );

  assert.equal(dropped.length, 0);
  assert.equal(curated.length, 1);
  const place = curated[0];
  // Curation fields from the model are preserved.
  assert.equal(place.description, "Model-written neutral description.");
  assert.equal(place.category, "culture");
  // Identity + metadata come from the cached Google candidate.
  assert.equal(place.address, "Somewhere");
  assert.equal(place.lat, 1);
  assert.equal(place.primaryType, "museum");
  assert.deepEqual(place.types, ["museum", "tourist_attraction"]);
  assert.equal(place.rating, 4.6);
  assert.equal(place.userRatingsTotal, 1200);
  assert.equal(place.qualityScore, computeQualityScore(4.6, 1200));
  assert.equal(place.popularity, computePopularity(1200));
});

test("buildCuratedPlaces matches a trimmed externalId", () => {
  const found = new Map<string, PlaceCandidate>([
    ["ChIJ_real", candidate({ externalId: "ChIJ_real", name: "Prado" })],
  ]);
  const { curated, dropped } = buildCuratedPlaces(
    [selection({ externalId: "  ChIJ_real  ", name: "Prado" })],
    found,
  );
  assert.equal(dropped.length, 0);
  assert.equal(curated[0].externalId, "ChIJ_real");
});

test("buildCuratedPlaces recovers a mangled externalId via normalized name", () => {
  const found = new Map<string, PlaceCandidate>([
    ["ChIJ_real", candidate({ externalId: "ChIJ_real", name: "Café René" })],
  ]);

  // Model garbled the ID but kept a recognizable (differently-cased/accented) name.
  const { curated, dropped } = buildCuratedPlaces(
    [selection({ externalId: "made-up-id", name: "cafe rene" })],
    found,
  );

  assert.equal(dropped.length, 0);
  assert.equal(curated.length, 1);
  // The authoritative externalId replaces the model's mangled one.
  assert.equal(curated[0].externalId, "ChIJ_real");
  assert.equal(curated[0].rating, 4.6);
});

test("buildCuratedPlaces drops selections that match no searched result", () => {
  const found = new Map<string, PlaceCandidate>([
    ["ChIJ_real", candidate({ externalId: "ChIJ_real", name: "Prado Museum" })],
  ]);

  const { curated, dropped } = buildCuratedPlaces(
    [
      selection({ externalId: "ChIJ_real", name: "Prado Museum" }),
      selection({ externalId: "hallucinated", name: "Nonexistent Hideaway" }),
    ],
    found,
  );

  assert.equal(curated.length, 1);
  assert.equal(curated[0].externalId, "ChIJ_real");
  assert.deepEqual(dropped, ["Nonexistent Hideaway (hallucinated)"]);
});

test("buildCuratedPlaces leaves quality/popularity undefined when Google has no ratings", () => {
  const found = new Map<string, PlaceCandidate>([
    [
      "ChIJ_park",
      candidate({
        externalId: "ChIJ_park",
        name: "Quiet Park",
        rating: undefined,
        userRatingsTotal: undefined,
        summary: undefined,
      }),
    ],
  ]);

  const { curated } = buildCuratedPlaces(
    [selection({ externalId: "ChIJ_park", name: "Quiet Park" })],
    found,
  );

  assert.equal(curated[0].rating, undefined);
  assert.equal(curated[0].qualityScore, undefined);
  assert.equal(curated[0].popularity, undefined);
});

test("buildCuratedPlaces returns empty results for an empty selection", () => {
  const { curated, dropped } = buildCuratedPlaces([], new Map());
  assert.deepEqual(curated, []);
  assert.deepEqual(dropped, []);
});
