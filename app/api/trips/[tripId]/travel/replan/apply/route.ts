import {
  applyPreparedReplan,
  ReplanConflictError,
} from "@/lib/itinerary/replan-apply";
import {
  isReplanConstraints,
  type ReplanConstraints,
  type ReplanStrategy,
} from "@/lib/itinerary/replan-contract";
import { createReplanRepository } from "@/lib/itinerary/replan-repository";
import { replanWithSolver } from "@/lib/itinerary/replan-solver";
import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/utils/supabase/server";

type ReplanRequest = {
  constraints?: ReplanConstraints;
  operations?: Json;
  strategy?: ReplanStrategy;
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
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }

  const { data: ownedTrip, error: ownershipError } = await supabase
    .from("trips")
    .select("id")
    .eq("id", tripId)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (ownershipError) {
    return Response.json({ error: ownershipError.message }, { status: 500 });
  }
  if (!ownedTrip) {
    return Response.json({ error: "Trip not found" }, { status: 404 });
  }

  if (body.strategy === "trim") {
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

  if (!isReplanConstraints(body.constraints)) {
    return Response.json(
      { error: "Valid replan constraints are required" },
      { status: 400 },
    );
  }

  try {
    const result = await replanWithSolver(tripId, body.constraints);
    const applied = await applyPreparedReplan({
      constraints: body.constraints,
      repository: createReplanRepository(supabase),
      result,
      tripId,
    });
    return Response.json(applied);
  } catch (error) {
    console.error("[replan-apply]", error);
    if (error instanceof ReplanConflictError) {
      return Response.json({ error: error.message }, { status: 409 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Replan failed" },
      { status: 500 },
    );
  }
}
