export interface PlaceCandidate {
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  primaryType?: string;
  types?: string[];
  summary?: string;
}

export interface DestinationCandidate {
  externalId: string;
  name: string;
  country?: string;
  adminArea?: string;
  lat: number;
  lng: number;
  description?: string;
}

// ---------------------------------------------------------------------------
// Mock data — used when GOOGLE_PLACES_API_KEY is not set
// ---------------------------------------------------------------------------

const MOCK_DESTINATIONS: Record<string, DestinationCandidate> = {
  madrid: {
    externalId: "mock-dest-madrid",
    name: "Madrid",
    country: "Spain",
    adminArea: "Community of Madrid",
    lat: 40.4168,
    lng: -3.7038,
    description: "The vibrant capital of Spain, known for world-class art, nightlife, and cuisine.",
  },
  barcelona: {
    externalId: "mock-dest-barcelona",
    name: "Barcelona",
    country: "Spain",
    adminArea: "Catalonia",
    lat: 41.3851,
    lng: 2.1734,
    description: "Gaudí's city — a feast of modernist architecture, beaches, and tapas bars.",
  },
  paris: {
    externalId: "mock-dest-paris",
    name: "Paris",
    country: "France",
    adminArea: "Île-de-France",
    lat: 48.8566,
    lng: 2.3522,
    description: "The City of Light — iconic monuments, haute cuisine, and romantic boulevards.",
  },
  "buenos aires": {
    externalId: "mock-dest-buenosaires",
    name: "Buenos Aires",
    country: "Argentina",
    adminArea: "Buenos Aires",
    lat: -34.6037,
    lng: -58.3816,
    description: "The Paris of South America — tango, steak, and European architecture.",
  },
  "new york": {
    externalId: "mock-dest-newyork",
    name: "New York",
    country: "United States",
    adminArea: "New York",
    lat: 40.7128,
    lng: -74.006,
    description: "The city that never sleeps — culture, diversity, and endless energy.",
  },
};

const MOCK_PLACES_BY_CATEGORY: Record<string, PlaceCandidate[]> = {
  museum: [
    { externalId: "mock-p-001", name: "National Museum of Art", address: "1 Museum Ave", lat: 40.418, lng: -3.706, primaryType: "museum", summary: "Stunning collection of European masters from the 15th to 20th century." },
    { externalId: "mock-p-002", name: "Contemporary Art Gallery", address: "22 Gallery St", lat: 40.421, lng: -3.701, primaryType: "art_gallery", summary: "Cutting-edge exhibitions featuring emerging and established artists." },
    { externalId: "mock-p-003", name: "History & Archaeology Museum", address: "5 History Blvd", lat: 40.414, lng: -3.710, primaryType: "museum", summary: "Artifacts spanning three millennia of local and regional history." },
  ],
  restaurant: [
    { externalId: "mock-p-004", name: "La Tasca Central", address: "10 Plaza Mayor", lat: 40.415, lng: -3.707, primaryType: "restaurant", summary: "Traditional local cuisine in a cozy, century-old dining room." },
    { externalId: "mock-p-005", name: "Mercado de Abastos", address: "3 Market Sq", lat: 40.420, lng: -3.700, primaryType: "food_market", summary: "Bustling food market with dozens of stalls serving fresh local produce and tapas." },
    { externalId: "mock-p-006", name: "Rooftop Sky Bar", address: "Av. Gran Vía 45", lat: 40.419, lng: -3.703, primaryType: "bar", summary: "Panoramic city views paired with creative cocktails and small plates." },
  ],
  park: [
    { externalId: "mock-p-007", name: "Parque Central", address: "Paseo del Parque s/n", lat: 40.422, lng: -3.714, primaryType: "park", summary: "The city's beloved green lung — perfect for a morning stroll or afternoon picnic." },
    { externalId: "mock-p-008", name: "Botanical Gardens", address: "Jardines s/n", lat: 40.408, lng: -3.698, primaryType: "botanical_garden", summary: "Over 5,000 plant species from five continents in a beautifully landscaped setting." },
  ],
  landmark: [
    { externalId: "mock-p-009", name: "Royal Palace", address: "Calle Bailén s/n", lat: 40.417, lng: -3.714, primaryType: "landmark", summary: "The official residence of the royal family — an opulent baroque masterpiece." },
    { externalId: "mock-p-010", name: "Old Cathedral", address: "Plaza de la Catedral 1", lat: 40.416, lng: -3.708, primaryType: "church", summary: "Gothic cathedral dating from the 13th century with a breathtaking carved facade." },
    { externalId: "mock-p-011", name: "City Viewpoint", address: "Cerro del Tío Pío", lat: 40.400, lng: -3.693, primaryType: "viewpoint", summary: "Best panoramic view of the city skyline, especially spectacular at sunset." },
  ],
  shopping: [
    { externalId: "mock-p-012", name: "Gran Bazar Artesanal", address: "Calle Fuencarral 80", lat: 40.424, lng: -3.702, primaryType: "market", summary: "Multi-floor artisan market with local crafts, vintage clothing, and design pieces." },
    { externalId: "mock-p-013", name: "Historic Bookshop", address: "Cuesta de Moyano 4", lat: 40.410, lng: -3.697, primaryType: "book_store", summary: "The oldest bookshop in the city, packed with rare editions and local authors." },
  ],
  nightlife: [
    { externalId: "mock-p-014", name: "Sala Jazz & Blues", address: "Calle Huertas 22", lat: 40.414, lng: -3.698, primaryType: "bar", summary: "Intimate live-music venue with nightly jazz sessions and craft beers on tap." },
    { externalId: "mock-p-015", name: "Teatro Flamenco", address: "Plaza de Santa Ana 15", lat: 40.415, lng: -3.700, primaryType: "performing_arts_theater", summary: "Authentic flamenco shows in an intimate 19th-century theater — book ahead." },
  ],
};

function mockSearchPlaces(query: string): PlaceCandidate[] {
  const q = query.toLowerCase();
  for (const [keyword, places] of Object.entries(MOCK_PLACES_BY_CATEGORY)) {
    if (q.includes(keyword)) return places;
  }
  // fallback: return a spread of all categories
  return Object.values(MOCK_PLACES_BY_CATEGORY).flat().slice(0, 5);
}

function mockResolveDestination(query: string): DestinationCandidate | null {
  const q = query.toLowerCase();
  for (const [key, dest] of Object.entries(MOCK_DESTINATIONS)) {
    if (q.includes(key)) return dest;
  }
  // generic fallback
  return {
    externalId: "mock-dest-generic",
    name: query,
    country: "Unknown",
    adminArea: undefined,
    lat: 40.0,
    lng: -3.0,
    description: `A wonderful destination: ${query}.`,
  };
}

// ---------------------------------------------------------------------------

function getApiKey(): string | null {
  return process.env.GOOGLE_PLACES_API_KEY ?? null;
}

export async function searchPlaces({
  query,
  latBias,
  lngBias,
}: {
  query: string;
  latBias?: number;
  lngBias?: number;
}): Promise<PlaceCandidate[]> {
  const apiKey = getApiKey();
  if (!apiKey) return mockSearchPlaces(query);

  const body: Record<string, unknown> = {
    textQuery: query,
  };

  if (latBias !== undefined && lngBias !== undefined) {
    body.locationBias = {
      circle: {
        center: {
          latitude: latBias,
          longitude: lngBias,
        },
        radius: 10000.0, // 10km bias for better coverage in cities
      },
    };
  }

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.editorialSummary",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const places = (data.places || []) as Array<{
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    editorialSummary?: { text: string };
  }>;

  return places.map((p) => ({
    externalId: p.id,
    name: p.displayName?.text || "",
    address: p.formattedAddress || "",
    lat: p.location?.latitude ?? 0,
    lng: p.location?.longitude ?? 0,
    primaryType: p.primaryType,
    types: p.types,
    summary: p.editorialSummary?.text,
  }));
}

export async function resolveDestination(
  query: string,
): Promise<DestinationCandidate | null> {
  const apiKey = getApiKey();
  if (!apiKey) return mockResolveDestination(query);

  const body = {
    textQuery: query,
  };

  const response = await fetch(
    "https://places.googleapis.com/v1/places:searchText",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.addressComponents,places.editorialSummary",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const place = data.places?.[0] as
    | {
        id: string;
        displayName?: { text: string };
        location?: { latitude: number; longitude: number };
        addressComponents?: Array<{ types: string[]; longText: string }>;
        editorialSummary?: { text: string };
      }
    | undefined;

  if (!place) return null;

  const getComponent = (type: string) =>
    place.addressComponents?.find((c) => c.types.includes(type))?.longText;

  return {
    externalId: place.id,
    name: place.displayName?.text || "",
    country: getComponent("country"),
    adminArea: getComponent("administrative_area_level_1"),
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    description: place.editorialSummary?.text,
  };
}
