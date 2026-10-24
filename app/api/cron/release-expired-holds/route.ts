import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const supplied = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || !supplied) return false;

  const expectedBuffer = Buffer.from(expected);
  const suppliedBuffer = Buffer.from(supplied);
  return expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer);
}

/**
 * Protected scheduled task. Configure your scheduler to send:
 * Authorization: Bearer <CRON_SECRET>
 * Never expose CRON_SECRET to browser code.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("release_expired_booking_holds", {
      p_limit: 500,
    });

    if (error) {
      console.error("Expired booking hold release failed", {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: "hold_release_failed" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: true, releasedSeats: data, bookingFlowLive: false },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(
      "Expired booking hold release is not configured",
      error instanceof Error ? error.message : "unknown error",
    );
    return NextResponse.json(
      { ok: false, error: "server_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
