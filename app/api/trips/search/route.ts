import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const response = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
    },
  });

const cleanCity = (value: string | null) =>
  (value ?? "").trim().replace(/\s+/g, " ").slice(0, 80);

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept, Content-Type",
      "Access-Control-Max-Age": "86400",
    },
  });
}

/**
 * Public, read-only trip search. Uses the server-only Supabase client and returns
 * only published trip/route fields. It never reads passenger or payment records
 * and does not reserve seats or create bookings.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const origin = cleanCity(params.get("origin"));
  const destination = cleanCity(params.get("destination"));
  const date = (params.get("date") ?? "").trim();

  if (!origin || !destination) {
    return response({
      ok: false,
      error: "origin_and_destination_required",
      message: "Provide origin and destination city names.",
    }, 400);
  }

  if (origin.toLocaleLowerCase() === destination.toLocaleLowerCase()) {
    return response({ ok: false, error: "same_city", message: "Origin and destination must differ." }, 400);
  }

  if (date && !validDate(date)) {
    return response({ ok: false, error: "invalid_date", message: "Date must use YYYY-MM-DD format." }, 400);
  }

  // Interpret requested travel dates in India Standard Time.
  const from = date
    ? new Date(`${date}T00:00:00+05:30`).toISOString()
    : new Date().toISOString();
  const until = date
    ? new Date(new Date(`${date}T00:00:00+05:30`).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : undefined;

  try {
    let query = getSupabaseAdmin()
      .from("trips")
      .select("id,bus_label,bus_type,departure_at,arrival_at,base_fare_paise,currency,routes!inner(origin_city,destination_city,origin_stop,destination_stop,active)")
      .eq("sales_open", true)
      .eq("routes.active", true)
      .ilike("routes.origin_city", origin)
      .ilike("routes.destination_city", destination)
      .gte("departure_at", from)
      .order("departure_at", { ascending: true })
      .limit(50);

    if (until) query = query.lt("departure_at", until);

    const { data, error } = await query;
    if (error) {
      return response({ ok: false, error: "trip_search_unavailable" }, 503);
    }

    return response({
      ok: true,
      trips: (data ?? []).map((trip) => ({
        id: trip.id,
        busLabel: trip.bus_label,
        busType: trip.bus_type,
        departureAt: trip.departure_at,
        arrivalAt: trip.arrival_at,
        farePaise: trip.base_fare_paise,
        currency: trip.currency.trim(),
        route: trip.routes,
      })),
      count: data?.length ?? 0,
      bookingEnabled: false,
      message: "Search results only. Seat reservation and booking are not enabled.",
    });
  } catch {
    return response({ ok: false, error: "database_not_configured" }, 503);
  }
}
