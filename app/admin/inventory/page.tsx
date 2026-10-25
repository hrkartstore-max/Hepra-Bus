"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent, InputHTMLAttributes } from "react";
import { ArrowRight, BusFront, CheckCircle2, CircleAlert, KeyRound, Route, ShieldCheck, Ticket } from "lucide-react";

type ApiResult = { ok?: boolean; error?: string; operator?: { id: string; name: string }; route?: { id: string; origin_city: string; destination_city: string }; stop?: { id: string; stop_name: string; stop_type: string }; trip?: { id: string; bus_label: string; departure_at: string }; seatsCreated?: number };
const inputStyle: CSSProperties = { width: "100%", minWidth: 0, border: "1px solid #dce3ec", borderRadius: 10, padding: "12px 13px", background: "#fff", color: "#16263b", outlineOffset: 2 };
const labelStyle: CSSProperties = { display: "grid", gap: 7, fontSize: 12, fontWeight: 700, color: "#536277" };
const buttonStyle: CSSProperties = { display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, border: 0, borderRadius: 10, padding: "12px 16px", background: "#f15a24", color: "#fff", fontWeight: 800, cursor: "pointer" };

export default function InventoryAdminPage() {
  const [token, setToken] = useState("");
  const [operatorName, setOperatorName] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [originCity, setOriginCity] = useState("Chennai");
  const [destinationCity, setDestinationCity] = useState("Bengaluru");
  const [originStop, setOriginStop] = useState("");
  const [destinationStop, setDestinationStop] = useState("");
  const [distanceKm, setDistanceKm] = useState("350");
  const [routeId, setRouteId] = useState("");
  const [stopType, setStopType] = useState<"boarding" | "dropping">("boarding");
  const [stopName, setStopName] = useState("");
  const [stopAddress, setStopAddress] = useState("");
  const [stopLandmark, setStopLandmark] = useState("");
  const [reportingMinutes, setReportingMinutes] = useState("15");
  const [stopOrder, setStopOrder] = useState("1");
  const [busLabel, setBusLabel] = useState("");
  const [busType, setBusType] = useState("AC Sleeper");
  const [departureAt, setDepartureAt] = useState("");
  const [arrivalAt, setArrivalAt] = useState("");
  const [fareRupees, setFareRupees] = useState("799");
  const [seatLabels, setSeatLabels] = useState("A1, A2, B1, B2, C1, C2");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [lastResult, setLastResult] = useState<ApiResult | null>(null);

  async function submit(action: "create_operator" | "create_route" | "create_route_stop" | "create_trip", data: Record<string, unknown>) {
    if (!token.trim()) { setMessage({ kind: "error", text: "Enter the server-configured admin token first. It is held only in this page's current memory." }); return null; }
    setBusy(action); setMessage(null); setLastResult(null);
    try {
      const response = await fetch("/api/admin/inventory", { method: "POST", headers: { "Content-Type": "application/json", "x-heprabus-admin-token": token }, body: JSON.stringify({ action, ...data }), cache: "no-store" });
      const payload = await response.json() as ApiResult;
      if (!response.ok || !payload.ok) {
        const friendly: Record<string, string> = {
          unauthorized: "Admin token was rejected. Check the server environment value.",
          server_not_configured: "Server database configuration is missing.",
          inventory_write_failed: "The database rejected this change. Check the fields and server logs.",
          active_operator_not_found: "Create an active operator first.",
          active_route_not_found: "Create the route first, then use its ID.",
          invalid_trip_or_seat_labels: "Check future departure, arrival, fare and unique seat labels.",
          invalid_route: "Check that the cities differ and distance is positive.",
          invalid_route_stop: "Check the route ID, stop name, stop type, reporting time and order.",
          route_stop_write_failed: "Could not save the route stop. Check the database migration and route ID.",
        };
        setMessage({ kind: "error", text: friendly[payload.error ?? ""] ?? `Request failed: ${payload.error ?? response.status}` }); return null;
      }
      setLastResult(payload);
      if (action === "create_operator" && payload.operator) setOperatorId(payload.operator.id);
      if (action === "create_route" && payload.route) setRouteId(payload.route.id);
      setMessage({ kind: "success", text: action === "create_operator" ? "Operator created. Its ID is ready for the route form." : action === "create_route" ? "Route created. Its ID is ready for the trip form and stop manager." : action === "create_route_stop" ? "Route stop saved. Add more stops with distinct order numbers." : `Trip created with ${payload.seatsCreated ?? 0} seats.` });
      return payload;
    } catch {
      setMessage({ kind: "error", text: "Could not reach the inventory API. Confirm deployment and try again." }); return null;
    } finally { setBusy(""); }
  }

  const field = (label: string, value: string, onChange: (value: string) => void, props: InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label style={labelStyle}>{label}<input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} {...props} /></label>
  );
  const idField = (label: string, value: string, onChange: (value: string) => void) => (
    <label style={labelStyle}>{label}<input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} placeholder="UUID from previous step" required /></label>
  );
  const localIso = (value: string) => {
    if (!value) return "";
    const d = new Date(value);
    const offset = -d.getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
    return `${value}:00${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
  };

  function onOperator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void submit("create_operator", { name: operatorName, supportEmail, supportPhone });
  }
  function onRoute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); void submit("create_route", { operatorId, originCity, destinationCity, originStop, destinationStop, distanceKm: distanceKm || null });
  }
  function onStop(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("create_route_stop", { routeId, stopType, stopName, address: stopAddress, landmark: stopLandmark, reportingMinutes: Number(reportingMinutes), sortOrder: Number(stopOrder) });
  }
  function onTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit("create_trip", { routeId, busLabel, busType, departureAt: localIso(departureAt), arrivalAt: localIso(arrivalAt), fareRupees: fareRupees === "" ? null : Number(fareRupees), seatLabels: seatLabels.split(",").map((seat) => seat.trim()).filter(Boolean) });
  }

  return <main style={{ minHeight: "100vh", background: "#f5f7fa", color: "#19283b" }}>
    <header style={{ background: "#10243d", color: "#fff", padding: "22px max(18px, calc((100vw - 1080px)/2))" }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "#fff", fontWeight: 900, fontSize: 20 }}><span style={{ background: "#f15a24", padding: 9, borderRadius: 10, display: "inline-flex" }}><BusFront size={22} /></span> hepra<span style={{ color: "#ff986b", marginLeft: -10 }}>bus</span><span style={{ fontSize: 11, color: "#aebbc9", fontWeight: 600, marginLeft: 8 }}>INVENTORY ADMIN</span></a>
    </header>
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 18px 64px" }}>
      <div style={{ marginBottom: 24 }}><div style={{ color: "#f15a24", fontSize: 11, fontWeight: 900, letterSpacing: 1.7, display: "flex", alignItems: "center", gap: 7 }}><ShieldCheck size={15} /> PRIVATE ADMIN TOOL</div><h1 style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: -1.4, margin: "10px 0 8px", color: "#10243d" }}>Manage your bus inventory.</h1><p style={{ color: "#738095", maxWidth: 700, lineHeight: 1.7, margin: 0 }}>Create an operator, connect a route, then publish a trip with its seat labels. IDs are passed to the next step automatically after successful creation.</p></div>
      <section style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 16, padding: 20, marginBottom: 18 }}>
        <h2 style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 17, margin: "0 0 8px", color: "#10243d" }}><KeyRound size={19} color="#f15a24" /> Admin access</h2>
        <p style={{ margin: "0 0 14px", color: "#738095", fontSize: 13, lineHeight: 1.6 }}>Enter the server-configured <code>HEPRABUS_ADMIN_TOKEN</code>. This page does not save it to local storage or cookies; clear it when finished.</p>
        <label style={labelStyle}>Admin token<input style={inputStyle} type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste your private admin token" /></label>
      </section>
      {message && <div role="status" style={{ display: "flex", alignItems: "flex-start", gap: 9, background: message.kind === "success" ? "#ecfdf3" : "#fff1f0", color: message.kind === "success" ? "#17663a" : "#a3261e", padding: 14, borderRadius: 12, marginBottom: 18, lineHeight: 1.5 }}>{message.kind === "success" ? <CheckCircle2 size={19} /> : <CircleAlert size={19} />}<span>{message.text}</span></div>}
      {lastResult && <section style={{ background: "#10243d", color: "#fff", borderRadius: 14, padding: 17, marginBottom: 18, overflowWrap: "anywhere" }}><b style={{ display: "block", marginBottom: 8 }}>Last created record ID</b><code style={{ fontSize: 12, color: "#ffd0b9" }}>{lastResult.operator?.id ?? lastResult.route?.id ?? lastResult.trip?.id ?? "—"}</code><div style={{ fontSize: 12, color: "#c4cfda", marginTop: 8 }}>{lastResult.operator?.name ?? (lastResult.route ? `${lastResult.route.origin_city} → ${lastResult.route.destination_city}` : lastResult.trip?.bus_label ?? "")}</div></section>}
      <div style={{ display: "grid", gap: 18 }}>
        <section style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}><span style={{ width: 42, height: 42, borderRadius: 12, background: "#fff1e9", color: "#f15a24", display: "grid", placeItems: "center" }}><BusFront /></span><div><div style={{ color: "#f15a24", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>STEP 01</div><h2 style={{ margin: "4px 0 0", fontSize: 20, color: "#10243d" }}>Create operator</h2></div></div>
          <form onSubmit={onOperator} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{field("Operator / company name", operatorName, setOperatorName, { required: true, minLength: 2, placeholder: "e.g. Hepra Express" })}{field("Support email (optional)", supportEmail, setSupportEmail, { type: "email", placeholder: "operations@example.com" })}{field("Support phone (optional)", supportPhone, setSupportPhone, { placeholder: "+91…" })}<div style={{ display: "flex", alignItems: "end" }}><button style={buttonStyle} type="submit" disabled={!!busy}>{busy === "create_operator" ? "Creating…" : "Create operator"} <ArrowRight size={16} /></button></div></form>
          {operatorId && <p style={{ fontSize: 12, overflowWrap: "anywhere", color: "#17663a", marginBottom: 0 }}>Operator ID: <code>{operatorId}</code></p>}
        </section>
        <section style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}><span style={{ width: 42, height: 42, borderRadius: 12, background: "#fff1e9", color: "#f15a24", display: "grid", placeItems: "center" }}><Route /></span><div><div style={{ color: "#f15a24", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>STEP 02</div><h2 style={{ margin: "4px 0 0", fontSize: 20, color: "#10243d" }}>Create route</h2></div></div>
          <form onSubmit={onRoute} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{idField("Active operator ID", operatorId, setOperatorId)}{field("Origin city", originCity, setOriginCity, { required: true })}{field("Destination city", destinationCity, setDestinationCity, { required: true })}{field("Origin pickup stop (optional)", originStop, setOriginStop, { placeholder: "Koyambedu" })}{field("Destination drop stop (optional)", destinationStop, setDestinationStop, { placeholder: "Majestic" })}{field("Distance in km (optional)", distanceKm, setDistanceKm, { type: "number", min: "0.1", step: "0.1" })}<div style={{ display: "flex", alignItems: "end" }}><button style={buttonStyle} type="submit" disabled={!!busy}>{busy === "create_route" ? "Creating…" : "Create route"} <ArrowRight size={16} /></button></div></form>
          {routeId && <p style={{ fontSize: 12, overflowWrap: "anywhere", color: "#17663a", marginBottom: 0 }}>Route ID: <code>{routeId}</code></p>}
        </section>
        <section style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}><span style={{ width: 42, height: 42, borderRadius: 12, background: "#f0eaff", color: "#6b35d5", display: "grid", placeItems: "center" }}><Route /></span><div><div style={{ color: "#6b35d5", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>STEP 03</div><h2 style={{ margin: "4px 0 0", fontSize: 20, color: "#10243d" }}>Add boarding / dropping stops</h2></div></div>
          <p style={{ color: "#738095", fontSize: 12, lineHeight: 1.6 }}>Use the route ID created in Step 02. Add every permitted stop; once a route has configured stops, booking validation uses those active stop names.</p>
          <form onSubmit={onStop} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{idField("Route ID", routeId, setRouteId)}<label style={labelStyle}>Stop type<select style={inputStyle} value={stopType} onChange={(e) => { const value = e.target.value as "boarding" | "dropping"; setStopType(value); setReportingMinutes(value === "boarding" ? "15" : "0"); }}><option value="boarding">Boarding / pickup</option><option value="dropping">Dropping / destination</option></select></label>{field("Stop name", stopName, setStopName, { required: true, minLength: 2, placeholder: "e.g. Koyambedu Bus Stand" })}{field("Address (optional)", stopAddress, setStopAddress, { placeholder: "Street, area" })}{field("Landmark (optional)", stopLandmark, setStopLandmark, { placeholder: "Near metro entrance" })}{field("Report early (minutes)", reportingMinutes, setReportingMinutes, { type: "number", min: "0", max: "180", step: "1", required: true })}{field("Display order", stopOrder, setStopOrder, { type: "number", min: "0", step: "1", required: true })}<div style={{ display: "flex", alignItems: "end" }}><button style={buttonStyle} type="submit" disabled={!!busy}>{busy === "create_route_stop" ? "Saving stop…" : "Save route stop"} <ArrowRight size={16} /></button></div></form>
        </section>
        <section style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 16, padding: 20 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18 }}><span style={{ width: 42, height: 42, borderRadius: 12, background: "#fff1e9", color: "#f15a24", display: "grid", placeItems: "center" }}><Ticket /></span><div><div style={{ color: "#f15a24", fontSize: 10, fontWeight: 900, letterSpacing: 1.5 }}>STEP 04</div><h2 style={{ margin: "4px 0 0", fontSize: 20, color: "#10243d" }}>Create trip + seats</h2></div></div>
          <form onSubmit={onTrip} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>{idField("Active route ID", routeId, setRouteId)}{field("Bus / service label", busLabel, setBusLabel, { required: true, minLength: 2, placeholder: "HB Chennai Express" })}{field("Bus type", busType, setBusType, { required: true, placeholder: "AC Sleeper" })}{field("Departure (your local time)", departureAt, setDepartureAt, { type: "datetime-local", required: true })}{field("Arrival (your local time)", arrivalAt, setArrivalAt, { type: "datetime-local", required: true })}{field("Fare per seat (₹)", fareRupees, setFareRupees, { type: "number", min: "0", max: "100000", step: "0.01", required: true })}{field("Seat labels, comma-separated", seatLabels, setSeatLabels, { required: true, placeholder: "A1, A2, B1, B2" })}<div style={{ display: "flex", alignItems: "end" }}><button style={buttonStyle} type="submit" disabled={!!busy}>{busy === "create_trip" ? "Creating…" : "Create trip and seats"} <ArrowRight size={16} /></button></div></form>
          <p style={{ color: "#738095", fontSize: 12, lineHeight: 1.6, marginBottom: 0 }}>Use future dates, distinct seat labels, and verify the fare and schedule before creating live inventory.</p>
        </section>
      </div>
      <p style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, lineHeight: 1.7, color: "#738095", marginTop: 22 }}><ShieldCheck size={17} /> Private admin utility only. It is not a full staff authentication system. Do not share the token or use this page on an untrusted device.</p>
      <a href="/" style={{ color: "#f15a24", fontWeight: 800, fontSize: 13 }}>← Back to HepraBus</a>
    </div>
  </main>;
}
