import { createClient } from "@/utils/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("advance_trip_travel", {
    target_trip_id: tripId,
  });

  if (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json(data[0]);
}
