import type { Json } from "@/lib/supabase/database.types";
import { createClient } from "@/utils/supabase/server";
import { replanWithSolver } from "@/lib/itinerary/replan-solver";

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

  if (body.strategy === "trim") {
    // Fallback to existing SQL logic for trim
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

  try {
    // 1. Fetch trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("status, current_itinerary_item_id, current_day_number, owner_id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) {
      return Response.json({ error: "Trip not found" }, { status: 404 });
    }
    if (trip.status !== "ongoing" || !trip.current_itinerary_item_id) {
      return Response.json({ error: "Trip is not ongoing" }, { status: 400 });
    }

    // 2. Fetch current item
    const { data: currentItem, error: itemError } = await supabase
      .from("itinerary_items")
      .select("*")
      .eq("id", trip.current_itinerary_item_id)
      .single();

    if (itemError || !currentItem) {
      return Response.json({ error: "Current item not found" }, { status: 404 });
    }

    // 3. Fetch source itinerary
    const { data: sourceItinerary, error: itinError } = await supabase
      .from("itineraries")
      .select("*")
      .eq("id", currentItem.itinerary_id)
      .eq("trip_id", tripId)
      .neq("status", "draft")
      .single();

    if (itinError || !sourceItinerary) {
      return Response.json({ error: "Current itinerary not found" }, { status: 404 });
    }

    // 4. Determine place IDs to exclude based on enabled remove operations
    const operations = (body.operations ?? []) as Array<{ type: string; itemId: string }>;
    const removeItemIds = operations.filter((op) => op.type === "remove").map((op) => op.itemId);
    
    let excludePlaceIds: string[] = [];
    if (removeItemIds.length > 0) {
      const { data: itemsToExclude } = await supabase
        .from("itinerary_items")
        .select("place_id")
        .in("id", removeItemIds);
      if (itemsToExclude) {
        excludePlaceIds = itemsToExclude.map((i) => i.place_id).filter((id): id is string => !!id);
      }
    }

    // 5. Run the replan solver
    const solverResult = await replanWithSolver({
      tripId,
      currentItemId: currentItem.id,
      currentDayNumber: trip.current_day_number!,
      excludePlaceIds,
    });

    // 6. Archive old itinerary
    await supabase
      .from("itineraries")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("id", sourceItinerary.id);

    // 7. Insert new active itinerary
    const { data: newItinerary, error: newItinError } = await supabase
      .from("itineraries")
      .insert({
        trip_id: tripId,
        status: "active",
        itinerary_type: sourceItinerary.itinerary_type,
        generated_from_itinerary_id: sourceItinerary.id,
        generation_prompt: sourceItinerary.generation_prompt,
        day_number: sourceItinerary.day_number,
        title: sourceItinerary.title,
      })
      .select("id")
      .single();

    if (newItinError || !newItinerary) {
      return Response.json({ error: newItinError?.message ?? "Failed to create new itinerary" }, { status: 500 });
    }

    // 8. Copy all items up to the current item
    const { data: allItems, error: allItemsError } = await supabase
      .from("itinerary_items")
      .select("*")
      .eq("itinerary_id", sourceItinerary.id)
      .order("position");

    if (allItemsError || !allItems) {
      return Response.json({ error: allItemsError?.message ?? "Failed to load itinerary items" }, { status: 500 });
    }

    const currentItemIndex = allItems.findIndex((i) => i.id === currentItem.id);
    const itemsToCopy = allItems.slice(0, currentItemIndex + 1);

    let newCurrentItemId = "";
    for (const item of itemsToCopy) {
      const { data: clonedItem, error: cloneError } = await supabase
        .from("itinerary_items")
        .insert({
          itinerary_id: newItinerary.id,
          place_id: item.place_id,
          item_type: item.item_type,
          title: item.title,
          description: item.description,
          starts_at: item.starts_at,
          ends_at: item.ends_at,
          position: item.position,
          locked: item.locked,
          score: item.score,
        })
        .select("id")
        .single();

      if (cloneError || !clonedItem) {
        return Response.json({ error: cloneError?.message ?? "Failed to clone itinerary item" }, { status: 500 });
      }

      if (item.id === currentItem.id) {
        newCurrentItemId = clonedItem.id;
      }
    }

    // 9. Insert new items from the solver
    for (const item of solverResult.newItems) {
      const { error: insertError } = await supabase
        .from("itinerary_items")
        .insert({
          itinerary_id: newItinerary.id,
          place_id: item.placeId,
          item_type: item.itemType,
          title: item.title,
          description: item.description,
          starts_at: item.startsAt,
          ends_at: item.endsAt,
          position: item.position,
          score: item.score,
        });
      
      if (insertError) {
        return Response.json({ error: insertError.message }, { status: 500 });
      }
    }

    // 10. Update trip
    const { error: updateTripError } = await supabase
      .from("trips")
      .update({
        current_itinerary_item_id: newCurrentItemId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    if (updateTripError) {
      return Response.json({ error: updateTripError.message }, { status: 500 });
    }

    return Response.json({ tripId });
  } catch (err) {
    console.error("[replan-apply] Error:", err);
    return Response.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
  }
}

