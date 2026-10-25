import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

export async function GET(request: NextRequest) {
  const tripId = (request.nextUrl.searchParams.get("tripId") || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tripId)) return json({ ok: false, error: "invalid_trip_id" }, 400);
  try {
    const supabase = getSupabaseAdmin();
    const { data: trip, error: tripError } = await supabase.from("trips").select("id,route_id").eq("id", tripId).maybeSingle();
    if (tripError) return json({ ok: false, error: "stops_unavailable" }, 503);
    if (!trip) return json({ ok: false, error: "trip_not_found" }, 404);
    const { data, error } = await supabase.from("route_stops").select("id,stop_name,stop_type,address,landmark,reporting_minutes,sort_order").eq("route_id", trip.route_id).eq("active", true).order("sort_order", { ascending: true });
    if (error) {
      if (error.code === "42P01" || error.code === "PGRST205") return json({ ok: true, stops: [], legacyFallback: true });
      return json({ ok: false, error: "stops_unavailable" }, 503);
    }
    return json({ ok: true, stops: data ?? [], legacyFallback: !(data?.length) });
  } catch {
    return json({ ok: false, error: "database_not_configured" }, 503);
  }
}
