import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

import type {
  ReplanApplyRepository,
  ReplanSnapshot,
} from "./replan-apply";

export function createReplanRepository(
  supabase: SupabaseClient<Database>,
): ReplanApplyRepository {
  return {
    async archiveItinerary(itineraryId) {
      const { data, error } = await supabase
        .from("itineraries")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("id", itineraryId)
        .eq("status", "active")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async createDraft(input) {
      const { data, error } = await supabase
        .from("itineraries")
        .insert({
          day_number: input.dayNumber,
          generated_from_itinerary_id: null,
          generation_prompt: input.generationPrompt,
          itinerary_type: input.itineraryType,
          status: "draft",
          title: input.title,
          trip_id: input.tripId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async deleteItinerary(itineraryId) {
      const { error } = await supabase
        .from("itineraries")
        .delete()
        .eq("id", itineraryId);
      if (error) throw error;
    },

    async insertItems(items) {
      const { data, error } = await supabase
        .from("itinerary_items")
        .insert(items)
        .select("id,position");
      if (error) throw error;
      return data;
    },

    async loadSnapshot(tripId) {
      return loadSnapshot(supabase, tripId);
    },

    async markItineraryActive(itineraryId, sourceItineraryId) {
      const { data, error } = await supabase
        .from("itineraries")
        .update({
          generated_from_itinerary_id: sourceItineraryId,
          status: "active",
          updated_at: new Date().toISOString(),
        })
        .eq("id", itineraryId)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },

    async restoreItinerary(itineraryId) {
      const { error } = await supabase
        .from("itineraries")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", itineraryId)
        .eq("status", "archived");
      if (error) throw error;
    },

    async updateCurrentItem(
      tripId,
      expectedCurrentItemId,
      nextCurrentItemId,
    ) {
      const { data, error } = await supabase
        .from("trips")
        .update({
          current_itinerary_item_id: nextCurrentItemId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tripId)
        .eq("status", "ongoing")
        .eq("current_itinerary_item_id", expectedCurrentItemId)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
  };
}

async function loadSnapshot(
  supabase: SupabaseClient<Database>,
  tripId: string,
): Promise<ReplanSnapshot | null> {
  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select("current_itinerary_item_id,status")
    .eq("id", tripId)
    .eq("status", "ongoing")
    .maybeSingle();
  if (tripError) throw tripError;
  if (!trip?.current_itinerary_item_id) return null;

  const { data: currentItem, error: currentItemError } = await supabase
    .from("itinerary_items")
    .select("itinerary_id")
    .eq("id", trip.current_itinerary_item_id)
    .maybeSingle();
  if (currentItemError) throw currentItemError;
  if (!currentItem) return null;

  const [{ data: itinerary, error: itineraryError }, itemsResult] =
    await Promise.all([
      supabase
        .from("itineraries")
        .select(
          "id,status,itinerary_type,generation_prompt,day_number,title",
        )
        .eq("id", currentItem.itinerary_id)
        .eq("trip_id", tripId)
        .maybeSingle(),
      supabase
        .from("itinerary_items")
        .select(
          "id,place_id,item_type,title,description,starts_at,ends_at,position,locked",
        )
        .eq("itinerary_id", currentItem.itinerary_id)
        .order("position"),
    ]);
  if (itineraryError) throw itineraryError;
  if (itemsResult.error) throw itemsResult.error;
  if (!itinerary) return null;

  return {
    currentItemId: trip.current_itinerary_item_id,
    sourceItinerary: itinerary,
    sourceItems: (itemsResult.data ?? []).map(
      (item): ReplanSnapshot["sourceItems"][number] => ({
        description: item.description,
        ends_at: item.ends_at,
        id: item.id,
        item_type: item.item_type,
        locked: item.locked,
        place_id: item.place_id,
        position: item.position,
        starts_at: item.starts_at,
        title: item.title,
      }),
    ),
  };
}
