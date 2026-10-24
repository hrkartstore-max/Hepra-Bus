import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const respond = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Public read-only seat inventory. Never returns booking IDs or passenger data.
 * A held seat is unavailable only while its hold has not expired.
 */
export async function GET(request: NextRequest) {
  const tripId = (request.nextUrl.searchParams.get("tripId") ?? "").trim();
  if (!uuid.test(tripId)) {
    return respond({ ok: false, error: "invalid_trip_id", message: "Provide a valid trip ID." }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const [{ data: trip, error: tripError }, { data: seats, error: seatsError }] = await Promise.all([
      supabase
        .from("trips")
        .select("id,sales_open,departure_at")
        .eq("id", tripId)
        .maybeSingle(),
      supabase
        .from("trip_seats")
        .select("seat_label,seat_type,status,held_until")
        .eq("trip_id", tripId)
        .order("seat_label", { ascending: true }),
    ]);

    if (tripError || seatsError) {
      return respond({ ok: false, error: "seat_inventory_unavailable" }, 503);
    }
    if (!trip) return respond({ ok: false, error: "trip_not_found" }, 404);

    const now = Date.now();
    const inventory = (seats ?? []).map((seat) => {
      const holdActive = seat.status === "held" && !!seat.held_until &&
        new Date(seat.held_until).getTime() > now;
      const available = seat.status === "available" ||
        (seat.status === "held" && !!seat.held_until && new Date(seat.held_until).getTime() <= now);
      return {
        label: seat.seat_label,
        type: seat.seat_type,
        status: available ? "available" : holdActive ? "held" : seat.status === "booked" ? "booked" : "blocked",
      };
    });

    const salesOpen = trip.sales_open && new Date(trip.departure_at).getTime() > now;
    return respond({
      ok: true,
      tripId: trip.id,
      salesOpen,
      departureAt: trip.departure_at,
      seats: inventory,
      counts: {
        total: inventory.length,
        available: salesOpen ? inventory.filter((seat) => seat.status === "available").length : 0,
        unavailable: inventory.filter((seat) => seat.status !== "available").length,
      },
      bookingEnabled: false,
      message: "Live seat inventory only. Seat holds require the booking flow; payment and ticket confirmation are not enabled.",
    });
  } catch {
    return respond({ ok: false, error: "database_not_configured" }, 503);
  }
}
