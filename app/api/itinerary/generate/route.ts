import { NextResponse } from "next/server";
import { generateItinerary } from "@/lib/itinerary/generate";

export async function POST(request: Request) {
  const body = await request.json();
  const { tripId, placeIds, config } = body;

  if (!tripId || !Array.isArray(placeIds)) {
    return NextResponse.json(
      { error: "tripId and placeIds[] are required" },
      { status: 400 }
    );
  }

  const result = await generateItinerary(tripId, placeIds, config);
  return NextResponse.json(result);
}
