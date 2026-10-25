import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { verifyStaffSession } from "../../../../../lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" },
});

export async function GET(request: NextRequest) {
  if (!verifyStaffSession(request)) return json({ ok: false, error: "unauthorized" }, 401);
  try {
    const db = getSupabaseAdmin();
    const status = request.nextUrl.searchParams.get("status") || "open";
    if (!["open", "investigating", "resolved", "refunded", "all"].includes(status)) {
      return json({ ok: false, error: "invalid_status" }, 400);
    }
    let query = db.from("payment_reconciliation_cases")
      .select("id,booking_id,payment_id,provider_payment_id,reason,status,details,created_at,updated_at,bookings(booking_reference,status),payments(amount_paise,currency)")
      .order("created_at", { ascending: false }).limit(100);
    if (status !== "all") query = query.eq("status", status);
    const { data, error } = await query;
    if (error) {
      console.error("Payment reconciliation queue read failed", { code: error.code });
      return json({ ok: false, error: "queue_unavailable" }, 503);
    }
    return json({ ok: true, cases: data ?? [] });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}

export async function PATCH(request: NextRequest) {
  if (!verifyStaffSession(request)) return json({ ok: false, error: "unauthorized" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const item = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const id = typeof item.id === "string" ? item.id : "";
  const status = typeof item.status === "string" ? item.status : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) ||
      !["open", "investigating", "resolved", "refunded"].includes(status)) {
    return json({ ok: false, error: "invalid_case_update" }, 400);
  }
  try {
    const db = getSupabaseAdmin();
    const { data, error } = await db.from("payment_reconciliation_cases")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).select("id,status,updated_at").maybeSingle();
    if (error) {
      console.error("Payment reconciliation case update failed", { code: error.code });
      return json({ ok: false, error: "case_update_failed" }, 503);
    }
    if (!data) return json({ ok: false, error: "case_not_found" }, 404);
    return json({ ok: true, case: data });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
