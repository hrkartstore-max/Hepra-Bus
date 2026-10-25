"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Clock3, CreditCard, RefreshCw, ShieldCheck, Ticket } from "lucide-react";

type Metrics = {
  pendingBookings: number; pendingBookingsPastExpiry: number; confirmedBookings: number;
  succeededPayments: number; openReconciliationCases: number; expiredBookings: number;
  succeededPaymentsWithoutConfirmedBooking: number;
};
type RecentCase = { id: string; reason: string; status: string; created_at: string; provider_payment_id: string; bookings?: { booking_reference?: string; status?: string } | Array<{ booking_reference?: string; status?: string }> | null; payments?: { amount_paise?: number; currency?: string } | Array<{ amount_paise?: number; currency?: string }> | null };
const card: CSSProperties = { background: "#fff", border: "1px solid #e5e9f0", borderRadius: 16, padding: 18, boxShadow: "0 10px 28px #17243a08" };
const button: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 7, border: "1px solid #d9deea", borderRadius: 10, padding: "10px 13px", background: "#fff", color: "#24334b", fontWeight: 800, cursor: "pointer" };
function one<T,>(v: T | T[] | null | undefined): T | undefined { return Array.isArray(v) ? v[0] : v ?? undefined; }
function money(paise?: number, currency?: string) { return typeof paise === "number" ? new Intl.NumberFormat("en-IN", { style: "currency", currency: currency || "INR", maximumFractionDigits: 2 }).format(paise / 100) : "—"; }
function prettyReason(s: string) { return s === "payment_captured_after_hold_expired" ? "Captured after hold expiry" : s === "seat_hold_inconsistent" ? "Seat inventory mismatch" : "Duplicate capture conflict"; }
export default function OperationsMonitorPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cases, setCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [message, setMessage] = useState("");
  const [generatedAt, setGeneratedAt] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setMessage("");
    try {
      const response = await fetch("/api/admin/operations-monitor", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 401) { setAuthenticated(false); setMessage("Please sign in to staff tools before viewing operations metrics."); setMetrics(null); return; }
      if (!response.ok || !data.ok) { setMessage("Monitoring data is unavailable. Check the database schema and server logs."); return; }
      setAuthenticated(true); setMetrics(data.metrics); setCases(data.recentCases || []); setGeneratedAt(data.generatedAt);
    } catch { setMessage("Network error. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const items = metrics ? [
    { label: "Pending bookings", value: metrics.pendingBookings, icon: <Ticket size={20}/>, note: "Waiting for payment or completion" },
    { label: "Pending past expiry", value: metrics.pendingBookingsPastExpiry, icon: <Clock3 size={20}/>, note: "Needs cleanup / investigation", alert: metrics.pendingBookingsPastExpiry > 0 },
    { label: "Confirmed bookings", value: metrics.confirmedBookings, icon: <CheckCircle2 size={20}/>, note: "Confirmed by payment workflow" },
    { label: "Captured payments", value: metrics.succeededPayments, icon: <CreditCard size={20}/>, note: "Payment records marked succeeded" },
    { label: "Open reconciliation", value: metrics.openReconciliationCases, icon: <AlertTriangle size={20}/>, note: "Needs staff review", alert: metrics.openReconciliationCases > 0 },
    { label: "Expired bookings", value: metrics.expiredBookings, icon: <Activity size={20}/>, note: "Seat holds already expired" },
    { label: "Paid, not confirmed", value: metrics.succeededPaymentsWithoutConfirmedBooking, icon: <AlertTriangle size={20}/>, note: "Cross-check with reconciliation queue", alert: metrics.succeededPaymentsWithoutConfirmedBooking > 0 },
  ] : [];
  return <main style={{ minHeight: "100vh", background: "#f3f5f9", color: "#17243a", padding: "24px 16px 48px", fontFamily: "Arial, Helvetica, sans-serif" }}>
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      <a href="/admin/verification" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#59677b", fontWeight: 700, fontSize: 13, marginBottom: 24 }}><ArrowLeft size={16}/> Staff verification</a>
      <header style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 18 }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "#6b35d5", color: "#fff", display: "grid", placeItems: "center" }}><ShieldCheck size={24}/></div>
        <div style={{ flex: 1 }}><div style={{ color: "#6b35d5", fontSize: 11, fontWeight: 900, letterSpacing: ".1em" }}>HEPRA BUS · OPERATIONS</div><h1 style={{ margin: "4px 0 0", fontSize: 27 }}>Booking & payment monitor</h1></div>
        <button onClick={() => void load()} style={button}><RefreshCw size={15}/> Refresh</button>
      </header>
      <p style={{ color: "#69768a", lineHeight: 1.65, fontSize: 13 }}>Live database counts to help staff spot expired holds and captured payments without confirmed bookings. This page is read-only; it does not alter bookings, seats, or payment records.</p>
      {message && <div role="status" style={{ ...card, marginBottom: 16, background: "#fff7f7", color: "#9a2c36" }}>{message} {!authenticated && <a href="/admin/verification" style={{ color: "#6b35d5", fontWeight: 800 }}> Sign in</a>}</div>}
      {loading && <div style={card}>Loading monitoring data…</div>}
      {metrics && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 12 }}>
        {items.map(item => <article key={item.label} style={{ ...card, borderColor: item.alert ? "#e9c6c6" : "#e5e9f0", background: item.alert ? "#fffafa" : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: item.alert ? "#a12c35" : "#6b35d5" }}>{item.icon}{item.alert && <AlertTriangle size={16}/>}</div>
          <div style={{ fontSize: 31, fontWeight: 900, letterSpacing: "-.04em", marginTop: 16 }}>{item.value.toLocaleString("en-IN")}</div>
          <div style={{ fontSize: 13, fontWeight: 850, marginTop: 4 }}>{item.label}</div>
          <div style={{ fontSize: 11, color: "#788397", lineHeight: 1.5, marginTop: 6 }}>{item.note}</div>
        </article>)}
      </div>}
      {generatedAt && <p style={{ color: "#8993a3", fontSize: 11, marginTop: 12 }}>Data generated: {new Date(generatedAt).toLocaleString("en-IN")}</p>}
      {metrics && <section style={{ ...card, marginTop: 18 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <h2 style={{ fontSize: 18, margin: 0 }}>Recent reconciliation cases</h2>
          <a href="/admin/reconciliation" style={{ color: "#6b35d5", fontWeight: 850, fontSize: 12 }}>Open queue →</a>
        </div>
        {cases.length === 0 ? <p style={{ color: "#788397", fontSize: 13 }}>No reconciliation cases recorded yet.</p> : <div style={{ display: "grid", gap: 10 }}>
          {cases.map(item => {
            const booking = one(item.bookings); const payment = one(item.payments);
            return <div key={item.id} style={{ border: "1px solid #edf0f5", borderRadius: 12, padding: 13, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
              <div><div style={{ color: "#788397", fontSize: 10, fontWeight: 800 }}>ISSUE</div><div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>{prettyReason(item.reason)}</div></div>
              <div><div style={{ color: "#788397", fontSize: 10, fontWeight: 800 }}>BOOKING</div><div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>{booking?.booking_reference || "—"}</div><div style={{ color: "#788397", fontSize: 11 }}>{booking?.status || "unknown"} · {item.status}</div></div>
              <div><div style={{ color: "#788397", fontSize: 10, fontWeight: 800 }}>PAYMENT</div><div style={{ fontWeight: 800, fontSize: 13, marginTop: 4 }}>{money(payment?.amount_paise, payment?.currency)}</div><div style={{ color: "#788397", fontSize: 10, overflowWrap: "anywhere" }}>{item.provider_payment_id}</div></div>
            </div>;
          })}
        </div>}
      </section>}
    </div>
  </main>;
}
