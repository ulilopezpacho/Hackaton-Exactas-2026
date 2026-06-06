export interface PlaceCandidate {
  externalId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  primaryType?: string;
  types?: string[];
  summary?: string;
  rating?: number;
  userRatingsTotal?: number;
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

export interface CitySuggestion {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  text: string;
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GOOGLE_MAPS_API_KEY is not set. The Google Places API is required for place and destination lookups.",
    );
  }
  return apiKey;
}

export async function searchCities({
  query,
  sessionToken,
}: {
  query: string;
  sessionToken: string;
}): Promise<CitySuggestion[]> {
  const apiKey = getApiKey();

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat.mainText.text,suggestions.placePrediction.structuredFormat.secondaryText.text",
    },
    body: JSON.stringify({
      includedPrimaryTypes: ["(cities)"],
      input: query,
      languageCode: "es",
      sessionToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    suggestions?: Array<{
      placePrediction?: {
        placeId?: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        text?: { text?: string };
      };
    }>;
  };

  return (data.suggestions ?? [])
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is NonNullable<typeof prediction> =>
      Boolean(prediction?.placeId && prediction.text?.text),
    )
    .map((prediction) => ({
      placeId: prediction.placeId ?? "",
      primaryText:
        prediction.structuredFormat?.mainText?.text ??
        prediction.text?.text ??
        "",
      secondaryText: prediction.structuredFormat?.secondaryText?.text ?? "",
      text: prediction.text?.text ?? "",
    }));
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
          "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types,places.editorialSummary,places.rating,places.userRatingCount",
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
    rating?: number;
    userRatingCount?: number;
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
    rating: p.rating,
    userRatingsTotal: p.userRatingCount,
  }));
}

export async function resolveDestination(
  query: string,
): Promise<DestinationCandidate | null> {
  const apiKey = getApiKey();
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

export async function getPlaceById(placeId: string): Promise<PlaceCandidate> {
  const apiKey = getApiKey();

  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
    {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,formattedAddress,location,primaryType,types,editorialSummary",
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${response.status} ${error}`);
  }

  const place = (await response.json()) as {
    id: string;
    displayName?: { text: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    primaryType?: string;
    types?: string[];
    editorialSummary?: { text: string };
  };

  return {
    address: place.formattedAddress || "",
    externalId: place.id,
    lat: place.location?.latitude ?? 0,
    lng: place.location?.longitude ?? 0,
    name: place.displayName?.text || "",
    primaryType: place.primaryType,
    summary: place.editorialSummary?.text,
    types: place.types,
  };
}
