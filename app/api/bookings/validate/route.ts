import { NextRequest, NextResponse } from "next/server";
import { validateCreateBooking, validateBookingLookup } from "@/lib/booking-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });

/**
 * Validation-only endpoint. It deliberately does not create, look up, reserve,
 * or change bookings. Database-backed handlers must be added separately.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json", message: "Send a valid JSON request body." }, 400);
  }

  const mode = request.nextUrl.searchParams.get("mode");
  const result = mode === "lookup"
    ? validateBookingLookup(body)
    : validateCreateBooking(body);

  if (!result.ok) {
    return json({ ok: false, error: "validation_failed", issues: result.issues }, 400);
  }

  return json({
    ok: true,
    mode: mode === "lookup" ? "lookup_validation" : "booking_validation",
    validated: result.value,
    persisted: false,
    message: "Input is valid, but no booking was created or retrieved. Database integration is not configured.",
  });
}
