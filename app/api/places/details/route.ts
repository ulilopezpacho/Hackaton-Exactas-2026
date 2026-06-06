import { getPlaceById } from "@/lib/places/google";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const placeId = searchParams.get("placeId")?.trim() ?? "";
  const sessionToken = searchParams.get("sessionToken")?.trim() ?? "";

  if (!placeId || !sessionToken) {
    return Response.json(
      { error: "Faltan datos para cargar el lugar." },
      { status: 400 },
    );
  }

  try {
    const place = await getPlaceById(placeId);

    return Response.json({
      place: {
        address: place.address,
        category: place.primaryType ?? place.types?.[0] ?? null,
        latitude: place.lat,
        longitude: place.lng,
        name: place.name,
        placeId: place.externalId,
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos cargar ese lugar ahora.",
      },
      { status: 503 },
    );
  }
}
