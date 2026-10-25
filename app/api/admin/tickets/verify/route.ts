import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" },
  });
}

function authorized(request: NextRequest) {
  const expected = process.env.HEPRABUS_ADMIN_TOKEN;
  const supplied = request.headers.get("x-heprabus-admin-token") ?? "";
  if (!expected || !supplied) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(a, b) && expected.length === supplied.length;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return json({ ok: false, error: "unauthorized" }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const reference = body && typeof body === "object" && "reference" in body && typeof body.reference === "string"
    ? body.reference.trim().toUpperCase() : "";
  if (!/^HB-[A-F0-9]{12}$/.test(reference)) return json({ ok: false, error: "invalid_reference" }, 400);

  try {
    const db = getSupabaseAdmin();
    const { data: booking, error } = await db.from("bookings")
      .select("booking_reference,status,trip_id,confirmed_at")
      .eq("booking_reference", reference).maybeSingle();
    if (error) {
      console.error("Staff ticket verification failed", { code: error.code });
      return json({ ok: false, error: "verification_unavailable" }, 503);
    }
    if (!booking) return json({ ok: true, found: false, message: "No booking found for this reference." }, 404);
    const { data: trip, error: tripError } = await db.from("trips")
      .select("bus_label,departure_at,arrival_at,routes(origin_city,destination_city)")
      .eq("id", booking.trip_id).maybeSingle();
    if (tripError) return json({ ok: false, error: "verification_unavailable" }, 503);
    const route = Array.isArray(trip?.routes) ? trip.routes[0] : trip?.routes;
    const valid = booking.status === "confirmed";
    return json({
      ok: true,
      found: true,
      ticket: {
        reference: booking.booking_reference,
        status: booking.status,
        valid,
        confirmedAt: valid ? booking.confirmed_at : null,
        busLabel: trip?.bus_label ?? null,
        departureAt: trip?.departure_at ?? null,
        arrivalAt: trip?.arrival_at ?? null,
        origin: route?.origin_city ?? null,
        destination: route?.destination_city ?? null,
      },
      message: valid ? "VALID TICKET — booking is confirmed." : "NOT VALID FOR BOARDING — booking is not confirmed.",
    });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
