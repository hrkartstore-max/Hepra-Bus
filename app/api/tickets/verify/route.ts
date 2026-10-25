import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } });
}

// Public verification intentionally excludes passenger names, phone, email, exact pickup/drop addresses and prices.
export async function GET(request: NextRequest) {
  const reference = (request.nextUrl.searchParams.get("reference") || "").trim().toUpperCase();
  if (!/^HB-[A-F0-9]{12}$/.test(reference)) return json({ ok: false, error: "invalid_reference" }, 400);
  try {
    const supabase = getSupabaseAdmin();
    const { data: booking, error } = await supabase.from("bookings")
      .select("booking_reference,status,trip_id,confirmed_at")
      .eq("booking_reference", reference).maybeSingle();
    if (error) {
      console.error("Ticket verification lookup failed", { code: error.code });
      return json({ ok: false, error: "verification_unavailable" }, 503);
    }
    if (!booking) return json({ ok: false, error: "ticket_not_found" }, 404);
    const { data: trip, error: tripError } = await supabase.from("trips")
      .select("bus_label,departure_at,arrival_at,routes(origin_city,destination_city)")
      .eq("id", booking.trip_id).maybeSingle();
    if (tripError) return json({ ok: false, error: "verification_unavailable" }, 503);
    const confirmed = booking.status === "confirmed";
    const route = Array.isArray(trip?.routes) ? trip?.routes[0] : trip?.routes;
    return json({
      ok: true,
      ticket: {
        reference: booking.booking_reference,
        status: booking.status,
        valid: confirmed,
        confirmedAt: confirmed ? booking.confirmed_at : null,
        busLabel: trip?.bus_label ?? null,
        departureAt: trip?.departure_at ?? null,
        arrivalAt: trip?.arrival_at ?? null,
        origin: route?.origin_city ?? null,
        destination: route?.destination_city ?? null,
      },
      message: confirmed ? "Booking confirmed by HEPRA BUS." : "This booking is not a confirmed ticket.",
    });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
