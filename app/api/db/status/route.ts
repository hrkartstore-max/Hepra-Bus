import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal readiness probe. Does not return database rows or secret values.
 * A successful response confirms server credentials and the operators table are reachable,
 * not that real booking flows are implemented.
 */
export async function GET() {
  try {
    const { error } = await getSupabaseAdmin()
      .from("operators")
      .select("id")
      .limit(1);

    if (error) {
      return NextResponse.json(
        { status: "unavailable", database: "supabase", connected: false },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        status: "ok",
        database: "supabase",
        connected: true,
        bookingFlowsLive: false,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unconfigured",
        database: "supabase",
        connected: false,
        bookingFlowsLive: false,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
