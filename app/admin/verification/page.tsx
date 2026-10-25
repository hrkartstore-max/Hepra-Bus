"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { AlertTriangle, ArrowLeft, BusFront, CheckCircle2, Search, ShieldCheck, Ticket, XCircle } from "lucide-react";

type TicketResult = {
  reference: string; status: string; valid: boolean; confirmedAt: string | null;
  busLabel: string | null; departureAt: string | null; arrivalAt: string | null;
  origin: string | null; destination: string | null;
};
const card: CSSProperties = { background: "#fff", border: "1px solid #e5e9f0", borderRadius: 18, padding: 20, boxShadow: "0 12px 35px #17243a0a" };
const label: React.CSSProperties = { display: "block", color: "#748096", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 };
const value: React.CSSProperties = { color: "#17243a", fontSize: 15, fontWeight: 750, overflowWrap: "anywhere" };

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function StaffVerificationPage() {
  const [token, setToken] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<TicketResult | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setResult(null); setMessage(""); setError(false);
    try {
      const response = await fetch("/api/admin/tickets/verify", {
        method: "POST", cache: "no-store",
        headers: { "Content-Type": "application/json", "x-heprabus-admin-token": token },
        body: JSON.stringify({ reference }),
      });
      const data = await response.json();
      if (data.ticket) setResult(data.ticket as TicketResult);
      setMessage(data.message || (data.error === "unauthorized" ? "Staff token rejected. Check the configured admin token." : data.error === "ticket_not_found" ? "Ticket not found." : data.error === "invalid_reference" ? "Enter a valid HEPRA BUS reference (HB- followed by 12 hexadecimal characters)." : "Verification could not be completed. Try again."));
      setError(!response.ok || !data.ticket?.valid);
    } catch {
      setMessage("Network error. Check your connection and try again."); setError(true);
    } finally { setBusy(false); }
  }

  return <main style={{ minHeight: "100vh", background: "#f3f5f9", color: "#17243a", padding: "24px 16px 48px", fontFamily: "Arial, Helvetica, sans-serif" }}>
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#59677b", fontWeight: 700, fontSize: 13, marginBottom: 24 }}><ArrowLeft size={16}/> HEPRA BUS home</a>
      <header style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 16, background: "#6b35d5", color: "white", display: "grid", placeItems: "center" }}><ShieldCheck size={26}/></div>
        <div><div style={{ fontSize: 11, color: "#6b35d5", fontWeight: 900, letterSpacing: ".12em" }}>HEPRA BUS · OPERATIONS</div><h1 style={{ margin: "4px 0 0", fontSize: 28, letterSpacing: "-.04em" }}>Ticket verification</h1></div>
      </header>
      <div style={{ ...card, marginBottom: 16 }}>
        <p style={{ color: "#68758a", fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>Check a ticket reference before boarding. Only confirmed bookings are marked valid. Passenger contact details are not displayed.</p>
        <form onSubmit={verify} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 800, color: "#536277" }}>STAFF / ADMIN TOKEN
            <input value={token} onChange={e => setToken(e.target.value)} type="password" autoComplete="current-password" required placeholder="Enter server-configured admin token" style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #dce3ec", background: "#fff" }}/>
          </label>
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 800, color: "#536277" }}>BOOKING REFERENCE
            <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} required maxLength={15} autoCapitalize="characters" placeholder="HB-XXXXXXXXXXXX" style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 11, border: "1px solid #dce3ec", fontSize: 18, letterSpacing: ".05em", fontWeight: 800 }}/>
          </label>
          <button disabled={busy} type="submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: 0, borderRadius: 11, padding: 14, background: "#6b35d5", color: "#fff", fontWeight: 850, cursor: busy ? "wait" : "pointer", opacity: busy ? .7 : 1 }}><Search size={17}/>{busy ? "Checking ticket…" : "Verify ticket"}</button>
        </form>
      </div>
      {message && <div role="status" style={{ ...card, marginBottom: 16, borderColor: result?.valid ? "#b8e7cd" : "#f1c8c8", background: result?.valid ? "#effbf4" : "#fff7f7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 850, color: result?.valid ? "#187544" : "#a12c35" }}>{result?.valid ? <CheckCircle2 size={22}/> : <AlertTriangle size={22}/>} {message}</div>
      </div>}
      {result && <section style={{ ...card, border: result.valid ? "2px solid #25a467" : "2px solid #d84b55" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          {result.valid ? <CheckCircle2 size={32} color="#18864b"/> : <XCircle size={32} color="#c5303d"/>}
          <div><div style={{ fontSize: 21, fontWeight: 900, color: result.valid ? "#187544" : "#b02c37" }}>{result.valid ? "VALID TICKET" : "DO NOT BOARD"}</div><div style={{ color: "#6c788b", fontSize: 12, marginTop: 3 }}>Status: {result.status.replaceAll("_", " ")}</div></div>
        </div>
        <div style={{ background: "#f4f1fc", borderRadius: 12, padding: 14, marginBottom: 18 }}><span style={label}>Booking reference</span><div style={{ ...value, fontSize: 22, letterSpacing: ".06em" }}>{result.reference}</div></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 18 }}>
          <div><span style={label}>Bus</span><div style={value}>{result.busLabel || "—"}</div></div>
          <div><span style={label}>Route</span><div style={value}>{result.origin || "Origin"} → {result.destination || "Destination"}</div></div>
          <div><span style={label}>Departure</span><div style={value}>{date(result.departureAt)}</div></div>
          <div><span style={label}>Arrival</span><div style={value}>{date(result.arrivalAt)}</div></div>
          <div><span style={label}>Confirmed at</span><div style={value}>{date(result.confirmedAt)}</div></div>
        </div>
        <p style={{ color: "#788397", fontSize: 11, margin: "20px 0 0", lineHeight: 1.6 }}>This check confirms booking status only. Match the passenger's ticket details and follow your operator's boarding procedure.</p>
      </section>}
      <footer style={{ textAlign: "center", color: "#8993a3", fontSize: 11, marginTop: 24 }}><BusFront size={15} style={{ verticalAlign: "middle", marginRight: 5 }}/> Internal staff tool · Do not share the admin token</footer>
    </div>
  </main>;
}
