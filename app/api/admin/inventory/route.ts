import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

function authorized(request: NextRequest): boolean {
  const expected = process.env.HEPRABUS_ADMIN_TOKEN;
  const supplied = request.headers.get("x-heprabus-admin-token") ?? "";
  if (!expected || !supplied) return false;
  // Hash to fixed-length buffers so timingSafeEqual never throws on length mismatch.
  const expectedHash = createHash("sha256").update(expected).digest();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash) && supplied.length === expected.length;
}

const text = (value: unknown, max = 120) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";

const uuid = (value: unknown) =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const seatLabelPattern = /^[A-Z]{1,2}[1-9][0-9]?$/;

export async function POST(request: NextRequest) {
  if (!authorized(request)) return json({ ok: false, error: "unauthorized" }, 401);

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
  const action = text(input.action, 20);

  try {
    const supabase = getSupabaseAdmin();

    if (action === "create_operator") {
      const name = text(input.name);
      const supportEmail = text(input.supportEmail, 254).toLowerCase();
      const supportPhone = text(input.supportPhone, 20);
      if (name.length < 2) return json({ ok: false, error: "invalid_operator_name" }, 400);
      if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) {
        return json({ ok: false, error: "invalid_support_email" }, 400);
      }
      const { data, error } = await supabase.from("operators")
        .insert({ name, support_email: supportEmail || null, support_phone: supportPhone || null })
        .select("id,name,active,created_at").single();
      if (error || !data) {
        console.error("Admin operator creation failed", { code: error?.code });
        return json({ ok: false, error: "inventory_write_failed" }, 503);
      }
      return json({ ok: true, operator: data }, 201);
    }

    if (action === "create_route") {
      const operatorId = input.operatorId;
      const originCity = text(input.originCity, 80);
      const destinationCity = text(input.destinationCity, 80);
      const originStop = text(input.originStop, 120);
      const destinationStop = text(input.destinationStop, 120);
      const distanceKm = input.distanceKm === undefined || input.distanceKm === null || input.distanceKm === ""
        ? null : Number(input.distanceKm);
      if (!uuid(operatorId) || originCity.length < 2 || destinationCity.length < 2 ||
          originCity.toLocaleLowerCase() === destinationCity.toLocaleLowerCase() ||
          (distanceKm !== null && (!Number.isFinite(distanceKm) || distanceKm <= 0))) {
        return json({ ok: false, error: "invalid_route" }, 400);
      }
      const { data: operator, error: operatorError } = await supabase.from("operators")
        .select("id").eq("id", operatorId).eq("active", true).maybeSingle();
      if (operatorError) return json({ ok: false, error: "inventory_read_failed" }, 503);
      if (!operator) return json({ ok: false, error: "active_operator_not_found" }, 400);
      const { data, error } = await supabase.from("routes").insert({
        operator_id: operatorId,
        origin_city: originCity,
        destination_city: destinationCity,
        origin_stop: originStop || null,
        destination_stop: destinationStop || null,
        distance_km: distanceKm,
      }).select("id,operator_id,origin_city,destination_city,origin_stop,destination_stop,active").single();
      if (error || !data) {
        console.error("Admin route creation failed", { code: error?.code });
        return json({ ok: false, error: "inventory_write_failed" }, 503);
      }
      return json({ ok: true, route: data }, 201);
    }

    if (action === "create_route_stop") {
      const routeId = input.routeId;
      const stopType = text(input.stopType, 20);
      const stopName = text(input.stopName, 160);
      const address = text(input.address, 240);
      const landmark = text(input.landmark, 160);
      const reportingMinutes = input.reportingMinutes === undefined || input.reportingMinutes === "" ? (stopType === "boarding" ? 15 : 0) : Number(input.reportingMinutes);
      const sortOrder = input.sortOrder === undefined || input.sortOrder === "" ? 0 : Number(input.sortOrder);
      if (!uuid(routeId) || !["boarding", "dropping"].includes(stopType) || stopName.length < 2 || !Number.isInteger(reportingMinutes) || reportingMinutes < 0 || reportingMinutes > 180 || !Number.isInteger(sortOrder) || sortOrder < 0) return json({ ok: false, error: "invalid_route_stop" }, 400);
      const { data: route, error: routeError } = await supabase.from("routes").select("id").eq("id", routeId).eq("active", true).maybeSingle();
      if (routeError) return json({ ok: false, error: "inventory_read_failed" }, 503);
      if (!route) return json({ ok: false, error: "active_route_not_found" }, 400);
      const { data, error } = await supabase.from("route_stops").upsert({ route_id: routeId, stop_type: stopType, stop_name: stopName, address: address || null, landmark: landmark || null, reporting_minutes: reportingMinutes, sort_order: sortOrder, active: true }, { onConflict: "route_id,stop_type,stop_name" }).select("id,route_id,stop_type,stop_name,address,landmark,reporting_minutes,sort_order,active").single();
      if (error || !data) { console.error("Admin route stop write failed", { code: error?.code }); return json({ ok: false, error: "route_stop_write_failed" }, 503); }
      return json({ ok: true, stop: data }, 201);
    }

    if (action === "create_trip") {
      const routeId = input.routeId;
      const busLabel = text(input.busLabel, 80);
      const busType = text(input.busType, 80) || "AC Sleeper";
      const departureAt = typeof input.departureAt === "string" ? input.departureAt : "";
      const arrivalAt = typeof input.arrivalAt === "string" ? input.arrivalAt : "";
      const fareRupees = Number(input.fareRupees);
      const seatLabels = Array.isArray(input.seatLabels)
        ? input.seatLabels.map((seat) => text(seat, 4).toUpperCase())
        : [];
      const departure = new Date(departureAt);
      const arrival = new Date(arrivalAt);
      if (!uuid(routeId) || busLabel.length < 2 ||
          !departureAt || !arrivalAt || !Number.isFinite(departure.getTime()) ||
          !Number.isFinite(arrival.getTime()) || arrival <= departure ||
          departure <= new Date() || !Number.isFinite(fareRupees) || fareRupees < 0 ||
          fareRupees > 100000 || Math.round(fareRupees * 100) !== fareRupees * 100 ||
          seatLabels.length < 1 || seatLabels.length > 60 ||
          seatLabels.some((seat) => !seatLabelPattern.test(seat)) ||
          new Set(seatLabels).size !== seatLabels.length) {
        return json({ ok: false, error: "invalid_trip_or_seat_labels" }, 400);
      }
      const { data: route, error: routeError } = await supabase.from("routes")
        .select("id").eq("id", routeId).eq("active", true).maybeSingle();
      if (routeError) return json({ ok: false, error: "inventory_read_failed" }, 503);
      if (!route) return json({ ok: false, error: "active_route_not_found" }, 400);

      const { data: trip, error: tripError } = await supabase.from("trips").insert({
        route_id: routeId,
        bus_label: busLabel,
        bus_type: busType,
        departure_at: departure.toISOString(),
        arrival_at: arrival.toISOString(),
        base_fare_paise: Math.round(fareRupees * 100),
        currency: "INR",
        sales_open: true,
      }).select("id,route_id,bus_label,bus_type,departure_at,arrival_at,base_fare_paise,currency,sales_open").single();
      if (tripError || !trip) {
        console.error("Admin trip creation failed", { code: tripError?.code });
        return json({ ok: false, error: "inventory_write_failed" }, 503);
      }

      const { error: seatsError } = await supabase.from("trip_seats").insert(
        seatLabels.map((seat) => ({ trip_id: trip.id, seat_label: seat, status: "available" })),
      );
      if (seatsError) {
        // Compensate for a failed seat insert so an incomplete trip is not left searchable.
        const { error: cleanupError } = await supabase.from("trips").delete().eq("id", trip.id);
        console.error("Admin seat creation failed", {
          code: seatsError.code,
          cleanupFailed: Boolean(cleanupError),
          tripId: cleanupError ? trip.id : undefined,
        });
        return json({ ok: false, error: cleanupError ? "trip_created_but_cleanup_failed" : "seat_creation_failed" }, 503);
      }

      return json({ ok: true, trip, seatsCreated: seatLabels.length }, 201);
    }

    return json({ ok: false, error: "unsupported_action", allowedActions: ["create_operator", "create_route", "create_route_stop", "create_trip"] }, 400);
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
