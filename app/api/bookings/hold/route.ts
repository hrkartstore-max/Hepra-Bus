import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PassengerInput = { seatLabel: string; passengerName: string };
type RequestBody = {
  tripId?: unknown;
  contactName?: unknown;
  phone?: unknown;
  email?: unknown;
  passengers?: unknown;
};

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });

// Per-instance protection only; configure a shared rate limiter and OTP before public launch.
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(request: NextRequest): boolean {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    if (attempts.size > 2_000) {
      for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
    }
    return false;
  }
  record.count += 1;
  return record.count > 8;
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) {
    return json({ ok: false, error: "rate_limited", message: "Too many attempts. Try again shortly." }, 429);
  }

  let body: RequestBody;
  try {
    body = await request.json() as RequestBody;
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "invalid_request" }, 400);
  }

  const tripId = cleanText(body.tripId, 36);
  const contactName = cleanText(body.contactName, 120);
  const phone = cleanText(body.phone, 24).replace(/[^0-9]/g, "");
  const email = cleanText(body.email, 254);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuid.test(tripId)) return json({ ok: false, error: "invalid_trip_id" }, 400);
  if (contactName.length < 2 || !/^[\p{L}\p{M} .'-]+$/u.test(contactName)) {
    return json({ ok: false, error: "invalid_contact_name" }, 400);
  }
  if (!/^[6-9][0-9]{9}$/.test(phone)) return json({ ok: false, error: "invalid_phone" }, 400);
  if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return json({ ok: false, error: "invalid_email" }, 400);
  }
  if (!Array.isArray(body.passengers) || body.passengers.length < 1 || body.passengers.length > 6) {
    return json({ ok: false, error: "invalid_passengers", message: "Choose 1 to 6 passengers." }, 400);
  }

  const passengers: PassengerInput[] = [];
  for (const item of body.passengers) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return json({ ok: false, error: "invalid_passenger" }, 400);
    }
    const passenger = item as Record<string, unknown>;
    const seatLabel = cleanText(passenger.seatLabel, 20).toUpperCase();
    const passengerName = cleanText(passenger.passengerName, 120);
    if (!/^[A-Z0-9-]{1,20}$/.test(seatLabel) ||
        passengerName.length < 2 ||
        !/^[\p{L}\p{M} .'-]+$/u.test(passengerName)) {
      return json({ ok: false, error: "invalid_passenger" }, 400);
    }
    passengers.push({ seatLabel, passengerName });
  }
  if (new Set(passengers.map((p) => p.seatLabel)).size !== passengers.length) {
    return json({ ok: false, error: "duplicate_seats" }, 400);
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc("create_booking_hold", {
      p_trip_id: tripId,
      p_contact_name: contactName,
      p_contact_phone: phone,
      p_contact_email: email || null,
      p_passengers: passengers.map((p) => ({
        seat_label: p.seatLabel,
        passenger_name: p.passengerName,
      })),
      p_hold_minutes: 10,
    });

    if (error) {
      if (error.code === "23505") {
        return json({ ok: false, error: "seat_unavailable", message: "One or more seats are no longer available." }, 409);
      }
      if (error.code === "P0002") {
        return json({ ok: false, error: "trip_or_seat_unavailable" }, 409);
      }
      if (error.code === "22023") return json({ ok: false, error: "invalid_booking" }, 400);
      console.error("Booking hold RPC failed", { code: error.code });
      return json({ ok: false, error: "booking_unavailable" }, 503);
    }

    return json({
      ok: true,
      booking: data,
      message: "Seats are temporarily held. Payment is not integrated; this is not a confirmed ticket.",
    }, 201);
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
