import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";

export async function POST(
  _request: Request,
  { params }: RouteContext<"/api/trips/[tripId]/save">,
) {
  const { tripId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      saved: false,
      status: "not_implemented",
      tripId,
    },
    { status: 202 },
  );
}
