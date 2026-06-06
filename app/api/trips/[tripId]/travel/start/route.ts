import { createClient } from "@/utils/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const body = (await request.json()) as { itemId?: string };

  if (!body.itemId) {
    return Response.json({ error: "itemId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_trip_travel", {
    target_item_id: body.itemId,
    target_trip_id: tripId,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ tripId: data });
}
