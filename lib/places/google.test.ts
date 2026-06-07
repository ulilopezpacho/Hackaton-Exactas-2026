import assert from "node:assert/strict";

import {
  getPlaceById,
  resolveDestination,
  searchCities,
  searchPlaces,
} from "./google";

/**
 * With the mock fallbacks removed, every entry point must fail loudly when
 * GOOGLE_MAPS_API_KEY is unset rather than returning fabricated data. The key
 * check runs before any network call, so these assertions need no fetch mock.
 */
function withoutApiKey(run: () => Promise<unknown>): () => Promise<void> {
  return async () => {
    const previous = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    try {
      await assert.rejects(run(), /GOOGLE_MAPS_API_KEY/);
    } finally {
      if (previous !== undefined) process.env.GOOGLE_MAPS_API_KEY = previous;
    }
  };
}

test(
  "searchPlaces throws without GOOGLE_MAPS_API_KEY",
  withoutApiKey(() => searchPlaces({ query: "museums in Madrid" })),
);

test(
  "resolveDestination throws without GOOGLE_MAPS_API_KEY",
  withoutApiKey(() => resolveDestination("Madrid")),
);

test(
  "searchCities throws without GOOGLE_MAPS_API_KEY",
  withoutApiKey(() => searchCities({ query: "Mad", sessionToken: "tok" })),
);

test(
  "getPlaceById throws without GOOGLE_MAPS_API_KEY",
  withoutApiKey(() => getPlaceById("ChIJ_anything")),
);
