import { searchCities } from "@/lib/places/google";

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
    const suggestions = await searchCities({ query: input, sessionToken });

    return Response.json({ suggestions });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No pudimos buscar ciudades ahora.",
      },
      { status: 503 },
    );
  }
}
