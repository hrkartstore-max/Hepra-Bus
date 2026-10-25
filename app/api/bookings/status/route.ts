import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });

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
  return item.count > 8;
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return json({ ok: false, error: "rate_limited", message: "Try again shortly." }, 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const input = body as Record<string, unknown>;
  const reference = typeof input.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
  if (!/^HB-[A-F0-9]{12}$/.test(reference)) {
    return json({ ok: false, error: "invalid_reference" }, 400);
  }
  if (!/^[6-9][0-9]{9}$/.test(phone)) {
    return json({ ok: false, error: "invalid_phone" }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("id, booking_reference, trip_id, status, currency, total_paise, expires_at, confirmed_at, created_at, boarding_point, dropping_point")
      .eq("booking_reference", reference)
      .eq("contact_phone", phone)
      .maybeSingle();

    if (error) {
      console.error("Booking status lookup failed", { code: error.code });
      return json({ ok: false, error: "lookup_unavailable" }, 503);
    }
    // Use the same response for missing reference and phone mismatch.
    if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);

    const [{ data: trip }, { data: passengers, error: passengerError }] = await Promise.all([
      supabase.from("trips")
        .select("bus_label, bus_type, departure_at, arrival_at, routes(origin_city, destination_city, origin_stop, destination_stop)")
        .eq("id", booking.trip_id)
        .maybeSingle(),
      supabase.from("booking_passengers")
        .select("passenger_name, fare_paise, trip_seat_id, trip_seats(seat_label)")
        .eq("booking_id", booking.id),
    ]);

    if (passengerError) {
      console.error("Booking passenger lookup failed", { code: passengerError.code });
      return json({ ok: false, error: "lookup_unavailable" }, 503);
    }

    return json({
      ok: true,
      booking: {
        reference: booking.booking_reference,
        status: booking.status,
        currency: booking.currency,
        totalPaise: booking.total_paise,
        boardingPoint: booking.boarding_point,
        droppingPoint: booking.dropping_point,
        expiresAt: booking.expires_at,
        confirmedAt: booking.confirmed_at,
        createdAt: booking.created_at,
        paymentIntegrated: false,
        trip: trip ?? null,
        passengers: (passengers ?? []).map((passenger: Record<string, unknown>) => ({
          name: passenger.passenger_name,
          farePaise: passenger.fare_paise,
          seat: Array.isArray(passenger.trip_seats)
            ? (passenger.trip_seats[0] as Record<string, unknown> | undefined)?.seat_label ?? null
            : (passenger.trip_seats as Record<string, unknown> | null)?.seat_label ?? null,
        })),
      },
      message: "Booking status retrieved. A pending seat hold is not a confirmed ticket.",
    });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
