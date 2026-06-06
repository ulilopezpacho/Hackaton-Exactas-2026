import { searchPlaces } from "@/lib/places/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const input = searchParams.get("q")?.trim() ?? "";
  const sessionToken = searchParams.get("sessionToken")?.trim() ?? "";

  if (input.length < 2) {
    return Response.json({ suggestions: [] });
  }

  if (!sessionToken) {
    return Response.json(
      { error: "Falta el token de sesión de búsqueda." },
      { status: 400 },
    );
  }

  try {
    const places = await searchPlaces({ query: input });
    const suggestions = places.map((place) => ({
      category: place.primaryType ?? place.types?.[0] ?? null,
      latitude: place.lat,
      longitude: place.lng,
      placeId: place.externalId,
      primaryText: place.name,
      secondaryText: place.address,
      text: place.address ? `${place.name}, ${place.address}` : place.name,
    }));

    return Response.json({ suggestions });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos buscar lugares ahora.",
      },
      { status: 503 },
    );
  }
}
