import assert from "node:assert/strict";
import test from "node:test";

import {
  matchCatalogCategories,
  mergeSearchInterests,
  sanitizeExtractedInterests,
} from "./preference-interests.ts";

const MEAL_CATEGORIES = ["restaurante", "café", "cafetería", "bar", "gastro"];

test("mergeSearchInterests preserves saved interests and appends extracted ones", () => {
  assert.deepEqual(
    mergeSearchInterests(
      ["Historia", "Gastronomía"],
      ["arquitectura modernista", "mercados locales"],
    ),
    ["Historia", "Gastronomía", "arquitectura modernista", "mercados locales"],
  );
});

test("mergeSearchInterests removes duplicates ignoring accents and formatting", () => {
  assert.deepEqual(
    mergeSearchInterests(
      ["Gastronomía", "Arte moderno"],
      [" gastronomia ", "arte-moderno", "Cafés históricos"],
    ),
    ["Gastronomía", "Arte moderno", "Cafés históricos"],
  );
});

test("sanitizeExtractedInterests drops invalid values and normalizes whitespace", () => {
  assert.deepEqual(
    sanitizeExtractedInterests([
      "  parques   tranquilos ",
      null,
      42,
      "",
      "comida regional",
    ]),
    ["parques tranquilos", "comida regional"],
  );
});

test("sanitizeExtractedInterests limits model output to twelve interests", () => {
  const interests = Array.from({ length: 15 }, (_, index) => `Interés ${index}`);

  assert.equal(sanitizeExtractedInterests(interests).length, 12);
});

test("matchCatalogCategories keeps matched activities and always keeps meal categories", () => {
  assert.deepEqual(
    matchCatalogCategories(
      ["Arte", "Historia", "Gastro", "Fútbol"],
      ["museos de arte", "historia"],
      MEAL_CATEGORIES,
    ),
    { activity: ["Arte", "Historia"], meal: ["Gastro"] },
  );
});

test("matchCatalogCategories matches accent- and case-insensitively", () => {
  assert.deepEqual(
    matchCatalogCategories(
      ["Café", "Arte"],
      ["ARTE moderno"],
      MEAL_CATEGORIES,
    ),
    { activity: ["Arte"], meal: ["Café"] },
  );
});

test("matchCatalogCategories returns no activities when interests are empty", () => {
  assert.deepEqual(
    matchCatalogCategories(["Arte", "Gastro"], [], MEAL_CATEGORIES),
    { activity: [], meal: ["Gastro"] },
  );
});
