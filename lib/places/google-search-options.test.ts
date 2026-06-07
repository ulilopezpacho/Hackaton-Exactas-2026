import { searchPlaces } from "./google";

describe("searchPlaces options", () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.GOOGLE_MAPS_API_KEY;

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_MAPS_API_KEY;
    } else {
      process.env.GOOGLE_MAPS_API_KEY = originalApiKey;
    }
  });

  test("sends recommendation filters to Google Places", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ places: [] }),
    }) as unknown as typeof fetch;

    await searchPlaces({
      query: "restaurantes",
      latBias: -34.6,
      lngBias: -58.4,
      radiusMeters: 3000,
      includedType: "restaurant",
      strictTypeFiltering: true,
      minRating: 4,
      priceLevels: ["PRICE_LEVEL_INEXPENSIVE"],
      rankPreference: "DISTANCE",
      pageSize: 20,
    });

    const request = (global.fetch as jest.Mock).mock.calls[0][1] as RequestInit;
    const body = JSON.parse(String(request.body));

    expect(body).toEqual({
      textQuery: "restaurantes",
      locationBias: {
        circle: {
          center: {
            latitude: -34.6,
            longitude: -58.4,
          },
          radius: 3000,
        },
      },
      includedType: "restaurant",
      strictTypeFiltering: true,
      minRating: 4,
      priceLevels: ["PRICE_LEVEL_INEXPENSIVE"],
      rankPreference: "DISTANCE",
      pageSize: 20,
    });
  });
});
