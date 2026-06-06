import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

type ReplanRequest = {
  operations?: Json;
  strategy?: "trim" | "recalculate" | "recommended";
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
