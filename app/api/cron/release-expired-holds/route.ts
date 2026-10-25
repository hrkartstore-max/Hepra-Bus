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
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function finishRun(db: ReturnType<typeof getSupabaseAdmin>, id: string | undefined, values: {
  status: "succeeded" | "failed"; releasedSeats?: number | null; errorCode?: string | null;
}) {
  if (!id) return;
  try {
    await db.from("cron_job_runs").update({
      status: values.status,
      finished_at: new Date().toISOString(),
      released_seats: values.releasedSeats ?? null,
      error_code: values.errorCode ?? null,
    }).eq("id", id);
  } catch (error) {
    console.error("Unable to update cron run history", error instanceof Error ? error.message : "unknown");
  }
}

/** Scheduled task: Authorization: Bearer <CRON_SECRET>. Never expose CRON_SECRET to browser code. */
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, {
      status: 401, headers: { "Cache-Control": "no-store" },
    });
  }

  let db: ReturnType<typeof getSupabaseAdmin>;
  let runId: string | undefined;
  try {
    db = getSupabaseAdmin();
    const { data: run, error: logError } = await db.from("cron_job_runs")
      .insert({ job_name: "release-expired-booking-holds", status: "running" })
      .select("id").single();
    if (logError) console.error("Unable to create cron run history", logError.code);
    else runId = run?.id;

    const { data, error } = await db.rpc("release_expired_booking_holds", { p_limit: 500 });
    if (error) {
      console.error("Expired booking hold release failed", { code: error.code, message: error.message });
      await finishRun(db, runId, { status: "failed", errorCode: error.code || "hold_release_failed" });
      return NextResponse.json({ ok: false, error: "hold_release_failed" }, {
        status: 503, headers: { "Cache-Control": "no-store" },
      });
    }
    const releasedSeats = typeof data === "number" ? data : Number(data ?? 0);
    await finishRun(db, runId, { status: "succeeded", releasedSeats });
    return NextResponse.json({ ok: true, releasedSeats: data, bookingFlowLive: false }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Expired booking hold release is not configured", error instanceof Error ? error.message : "unknown");
    if (db!) await finishRun(db, runId, { status: "failed", errorCode: "server_not_configured" });
    return NextResponse.json({ ok: false, error: "server_not_configured" }, {
      status: 503, headers: { "Cache-Control": "no-store" },
    });
  }
}
