import type { Json } from "@/lib/supabase/database.types";
import { replanItinerary } from "@/lib/itinerary/replan";
import { createClient } from "@/utils/supabase/server";

type ReplanRequest = {
  operations?: Json;
  strategy?: "trim" | "recalculate" | "recommended" | "solver";
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as ReplanRequest;

  if (!body.strategy) {
    return Response.json({ error: "strategy is required" }, { status: 400 });
  }

  if (body.strategy === "solver") {
    try {
      const result = await replanItinerary(tripId);
      return Response.json({ tripId, solverScore: result.score });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Solver replan failed";
      return Response.json({ error: message }, { status: 400 });
    }
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("apply_trip_replan", {
    operations: body.operations ?? [],
    strategy: body.strategy,
    target_trip_id: tripId,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ tripId: data });
}
