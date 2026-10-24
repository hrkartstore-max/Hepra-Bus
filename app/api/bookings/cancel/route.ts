import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const item = attempts.get(ip);
  if (!item || item.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    if (attempts.size > 2_000) {
      for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
    }
    return false;
  }
  item.count += 1;
  return item.count > 5;
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) return json({ ok: false, error: "rate_limited", message: "Too many attempts. Try again shortly." }, 429);

  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "invalid_request" }, 400);

  const input = body as Record<string, unknown>;
  const reference = typeof input.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
  if (!/^HB-[A-F0-9]{12}$/.test(reference)) return json({ ok: false, error: "invalid_reference" }, 400);
  if (!/^[6-9][0-9]{9}$/.test(phone)) return json({ ok: false, error: "invalid_phone" }, 400);

  try {
    const { data, error } = await getSupabaseAdmin().rpc("cancel_booking_hold", {
      p_booking_reference: reference,
      p_contact_phone: phone,
    });
    if (error) {
      if (error.code === "P0002") return json({ ok: false, error: "booking_not_found", message: "No booking found for that reference and mobile number." }, 404);
      if (error.code === "22023") return json({ ok: false, error: "invalid_request" }, 400);
      console.error("Booking hold cancellation failed", { code: error.code });
      return json({ ok: false, error: "cancellation_unavailable" }, 503);
    }
    return json({ ok: true, result: data, message: data?.message ?? "Booking hold status updated." });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
