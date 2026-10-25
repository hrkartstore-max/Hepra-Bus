"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

type CaseRow = {
  id: string; provider_payment_id: string; reason: string; status: string;
  created_at: string; details: Record<string, unknown>;
  bookings?: { booking_reference?: string; status?: string } | Array<{ booking_reference?: string; status?: string }> | null;
  payments?: { amount_paise?: number; currency?: string } | Array<{ amount_paise?: number; currency?: string }> | null;
};
const card: CSSProperties = { background: "#fff", border: "1px solid #e5e9f0", borderRadius: 16, padding: 16 };
const btn: CSSProperties = { border: "1px solid #d9deea", borderRadius: 9, padding: "9px 12px", background: "#fff", color: "#24334b", fontWeight: 800, cursor: "pointer" };
function one<T,>(v: T | T[] | null | undefined): T | undefined { return Array.isArray(v) ? v[0] : v ?? undefined; }
function date(v: string) { const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }); }
function reasonText(reason: string) {
  if (reason === "payment_captured_after_hold_expired") return "Payment captured after seat hold expired";
  if (reason === "seat_hold_inconsistent") return "Seat inventory inconsistent";
  return "Duplicate capture needs review";
}
export default function PaymentReconciliationPage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [status, setStatus] = useState("open");
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState("");
  async function load() {
    setLoading(true); setMessage("");
    try {
      const session = await fetch("/api/admin/staff-session", { cache: "no-store" }).then(r => r.json());
      if (!session.ok) { setAuthenticated(false); setMessage("Sign in through the staff verification dashboard first, then return here."); setCases([]); return; }
      setAuthenticated(true);
      const response = await fetch("/api/admin/payment-reconciliation?status=" + encodeURIComponent(status), { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) { setMessage(data.error === "queue_unavailable" ? "Queue unavailable. Confirm the reconciliation migration has been applied." : "Could not load reconciliation cases."); setCases([]); }
      else setCases(data.cases ?? []);
    } catch { setMessage("Network error. Try again."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [status]);
  async function update(id: string, nextStatus: string) {
    setBusyId(id); setMessage("");
    try {
      const response = await fetch("/api/admin/payment-reconciliation", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: nextStatus }) });
      const data = await response.json();
      if (!response.ok || !data.ok) setMessage("Could not update case status.");
      else await load();
    } catch { setMessage("Network error while updating case."); }
    finally { setBusyId(""); }
  }
  return <main style={{ minHeight: "100vh", background: "#f3f5f9", color: "#17243a", padding: "24px 16px 48px", fontFamily: "Arial, Helvetica, sans-serif" }}>
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <a href="/admin/verification" style={{ display: "inline-flex", gap: 8, alignItems: "center", color: "#59677b", fontWeight: 700, fontSize: 13, marginBottom: 24 }}><ArrowLeft size={16}/> Staff verification</a>
      <header style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#6b35d5", color: "#fff", display: "grid", placeItems: "center" }}><ShieldCheck size={24}/></div>
        <div style={{ flex: 1 }}><div style={{ color: "#6b35d5", fontSize: 11, fontWeight: 900, letterSpacing: ".1em" }}>HEPRA BUS · PAYMENTS</div><h1 style={{ margin: "4px 0 0", fontSize: 27 }}>Reconciliation queue</h1></div>
        <button onClick={() => void load()} style={btn}><RefreshCw size={15} style={{ verticalAlign: "middle", marginRight: 6 }}/>Refresh</button>
      </header>
      <p style={{ color: "#69768a", lineHeight: 1.6, fontSize: 13 }}>Captured payments that could not automatically confirm a booking are listed here. Review each case in Razorpay and your booking records before marking it resolved or refunded. This page does not issue refunds or automatically confirm bookings.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "18px 0" }}>
        {["open", "investigating", "resolved", "refunded", "all"].map(s => <button key={s} onClick={() => setStatus(s)} style={{ ...btn, background: status === s ? "#6b35d5" : "#fff", color: status === s ? "#fff" : "#24334b", borderColor: status === s ? "#6b35d5" : "#d9deea", textTransform: "capitalize" }}>{s}</button>)}
      </div>
      {message && <div role="status" style={{ ...card, marginBottom: 14, color: "#9a2c36", background: "#fff7f7" }}>{message} {!authenticated && <a href="/admin/verification" style={{ color: "#6b35d5", fontWeight: 800 }}>Sign in</a>}</div>}
      {loading && <div style={card}>Loading cases…</div>}
      {!loading && authenticated && cases.length === 0 && <div style={{ ...card, textAlign: "center", padding: 32 }}><CheckCircle2 size={28} color="#18864b"/><h2 style={{ fontSize: 18 }}>No cases in this view</h2><p style={{ color: "#69768a", fontSize: 13 }}>No payment reconciliation cases matched this filter.</p></div>}
      <div style={{ display: "grid", gap: 12 }}>
        {cases.map(item => {
          const booking = one(item.bookings); const payment = one(item.payments);
          return <article key={item.id} style={{ ...card, borderColor: item.status === "open" ? "#f0d7a7" : "#e5e9f0" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <CircleAlert size={22} color={item.status === "open" ? "#b87512" : "#6b35d5"}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900 }}>{reasonText(item.reason)}</div>
                <div style={{ color: "#6e7b8f", fontSize: 12, marginTop: 5 }}>Created {date(item.created_at)} · Status: <b>{item.status}</b></div>
              </div>
              <div style={{ textAlign: "right", fontWeight: 900 }}>{typeof payment?.amount_paise === "number" ? "₹" + (payment.amount_paise / 100).toLocaleString("en-IN") : "—"}<div style={{ color: "#788397", fontSize: 10 }}>{payment?.currency || "INR"}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12, marginTop: 16 }}>
              <div><div style={{ color: "#788397", fontSize: 10, fontWeight: 800 }}>BOOKING REFERENCE</div><div style={{ fontWeight: 850, marginTop: 5 }}>{booking?.booking_reference || "—"}</div><div style={{ color: "#788397", fontSize: 11, marginTop: 3 }}>Booking status: {booking?.status || "unknown"}</div></div>
              <div><div style={{ color: "#788397", fontSize: 10, fontWeight: 800 }}>RAZORPAY PAYMENT ID</div><div style={{ fontWeight: 750, marginTop: 5, overflowWrap: "anywhere" }}>{item.provider_payment_id}</div></div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 16 }}>
              {item.status !== "investigating" && item.status !== "resolved" && item.status !== "refunded" && <button disabled={busyId === item.id} onClick={() => void update(item.id, "investigating")} style={btn}>Mark investigating</button>}
              {item.status !== "resolved" && <button disabled={busyId === item.id} onClick={() => void update(item.id, "resolved")} style={btn}>Mark resolved</button>}
              {item.status !== "refunded" && <button disabled={busyId === item.id} onClick={() => void update(item.id, "refunded")} style={{ ...btn, color: "#9a2c36" }}>Mark refunded</button>}
            </div>
          </article>;
        })}
      </div>
    </div>
  </main>;
}
