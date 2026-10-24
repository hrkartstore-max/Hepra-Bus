"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BusFront, RefreshCw, Search, ShieldAlert, TicketCheck, Users, Wallet } from "lucide-react";

type DemoBooking = {
  reference: string;
  from: string;
  to: string;
  date: string;
  name: string;
  phone: string;
  seats: string;
  total: string;
  status: string;
};

const STORAGE_KEY = "heprabus-demo-bookings";
const money = (value: string | number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);

export default function DemoAdminPage() {
  const [bookings, setBookings] = useState<DemoBooking[]>([]);
  const [query, setQuery] = useState("");
  const [loaded, setLoaded] = useState(false);

  function refreshBookings() {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
      setBookings(Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.reference === "string") : []);
    } catch {
      setBookings([]);
    }
    setLoaded(true);
  }

  useEffect(() => {
    refreshBookings();
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) refreshBookings();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return bookings;
    return bookings.filter((booking) =>
      [booking.reference, booking.from, booking.to, booking.name, booking.phone, booking.date]
        .some((value) => String(value || "").toLowerCase().includes(needle))
    );
  }, [bookings, query]);

  const totalValue = bookings.reduce((sum, booking) => sum + (Number(booking.total) || 0), 0);
  const passengers = bookings.length;

  return (
    <main className="admin-demo-page">
      <header className="admin-demo-header">
        <Link href="/" className="admin-demo-brand"><span><BusFront size={22} /></span><b>hepra<span>bus</span></b><small>DEMO OPERATIONS</small></Link>
        <Link href="/" className="admin-back-link"><ArrowLeft size={15} /> Back to website</Link>
      </header>

      <section className="admin-demo-content">
        <div className="admin-demo-eyebrow">LOCAL DEMO DASHBOARD</div>
        <div className="admin-demo-title-row"><div><h1>Booking overview</h1><p>Inspect demo bookings saved in this browser.</p></div><button className="admin-refresh" onClick={refreshBookings}><RefreshCw size={15} /> Refresh</button></div>

        <div className="admin-demo-warning"><ShieldAlert size={19} /><p><b>Demo mode only.</b> This page has no login or server database. It can only read demo records from this browser's local storage. Do not use it for real passenger data or live booking operations.</p></div>

        <div className="admin-stat-grid">
          <article><span><TicketCheck size={18} /></span><small>Saved demo bookings</small><strong>{loaded ? bookings.length : "—"}</strong><em>In this browser only</em></article>
          <article><span><Users size={18} /></span><small>Passenger records</small><strong>{loaded ? passengers : "—"}</strong><em>One record per demo booking</em></article>
          <article><span><Wallet size={18} /></span><small>Sample fare total</small><strong>{loaded ? money(totalValue) : "—"}</strong><em>Not actual revenue</em></article>
        </div>

        <section className="admin-bookings-panel">
          <div className="admin-panel-head"><div><h2>Demo booking records</h2><p>{filtered.length} result{filtered.length === 1 ? "" : "s"}</p></div><label className="admin-search"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search reference, route, passenger…" /></label></div>
          {!loaded ? <p className="admin-empty">Loading browser records…</p> : filtered.length === 0 ? <div className="admin-empty"><TicketCheck size={27} /><b>{bookings.length ? "No matching records" : "No demo bookings saved yet"}</b><p>{bookings.length ? "Try another search term." : "Complete a demo booking on the homepage using this same browser, then refresh this page."}</p><Link href="/" className="admin-home-cta">Open booking demo</Link></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Journey</th><th>Date</th><th>Passenger</th><th>Seats</th><th>Sample fare</th><th>Status</th></tr></thead><tbody>{filtered.map((booking) => <tr key={booking.reference}><td><b>{booking.reference}</b><small>{booking.phone || "No phone saved"}</small></td><td>{booking.from} <span>→</span> {booking.to}</td><td>{booking.date || "—"}</td><td>{booking.name || "—"}</td><td>{booking.seats || "—"}</td><td><b>{money(booking.total)}</b></td><td><span className="admin-demo-status">Demo · not ticketed</span></td></tr>)}</tbody></table></div>}
        </section>
        <p className="admin-demo-footnote">Privacy note: these records stay in this browser's local storage. This page does not transmit them to a server.</p>
      </section>

      <style jsx>{`
        .admin-demo-page{min-height:100vh;background:#f5f7fa;color:#17243b;font-family:Arial,Helvetica,sans-serif}
        .admin-demo-header{height:76px;background:#fff;border-bottom:1px solid #e5eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 max(22px,calc((100vw - 1180px)/2))}
        .admin-demo-brand{display:flex;align-items:center;gap:10px;text-decoration:none;color:#17243b}.admin-demo-brand>span{width:38px;height:38px;display:grid;place-items:center;background:#17243b;color:#fff;border-radius:11px}.admin-demo-brand>b{font-size:21px;letter-spacing:-1px}.admin-demo-brand>b span{color:#f47735}.admin-demo-brand small{font-size:9px;letter-spacing:1.4px;color:#7c8797;margin-left:4px;font-weight:800}
        .admin-back-link{display:flex;align-items:center;gap:7px;text-decoration:none;color:#5b687a;font-size:12px;font-weight:700}
        .admin-demo-content{max-width:1180px;margin:0 auto;padding:42px 22px 65px}.admin-demo-eyebrow{font-size:10px;letter-spacing:1.8px;font-weight:900;color:#f47735}.admin-demo-title-row{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:8px 0 23px}.admin-demo-title-row h1{font-size:clamp(28px,4vw,38px);letter-spacing:-1.5px;margin:0;color:#17243b}.admin-demo-title-row p{font-size:13px;color:#7c8797;margin:8px 0 0}.admin-refresh{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #dfe5ec;border-radius:9px;padding:11px 14px;color:#17243b;font-weight:800;font-size:12px;cursor:pointer}
        .admin-demo-warning{display:flex;gap:12px;align-items:flex-start;padding:15px 17px;border:1px solid #f2d5a6;border-radius:12px;background:#fff8eb;color:#80541a}.admin-demo-warning svg{flex-shrink:0;margin-top:1px}.admin-demo-warning p{font-size:11px;line-height:1.7;margin:0}
        .admin-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin:20px 0}.admin-stat-grid article{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:9px;background:#fff;border:1px solid #e5eaf0;border-radius:14px;padding:20px}.admin-stat-grid article>span{width:36px;height:36px;display:grid;place-items:center;background:#fff0e8;border-radius:10px;color:#e96b2c}.admin-stat-grid small{font-size:11px;color:#7c8797}.admin-stat-grid strong{font-size:29px;letter-spacing:-1px;color:#17243b}.admin-stat-grid em{font-size:10px;font-style:normal;color:#9aa3af}
        .admin-bookings-panel{background:#fff;border:1px solid #e5eaf0;border-radius:15px;overflow:hidden}.admin-panel-head{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:21px;border-bottom:1px solid #e8edf2}.admin-panel-head h2{font-size:16px;margin:0;color:#17243b}.admin-panel-head p{font-size:11px;color:#7c8797;margin:6px 0 0}.admin-search{display:flex;align-items:center;gap:8px;max-width:360px;width:100%;border:1px solid #dfe5ec;border-radius:9px;padding:0 11px;color:#8792a2}.admin-search input{width:100%;height:40px;border:0;outline:0;background:transparent;font-size:12px;color:#17243b;min-width:0}
        .admin-table-wrap{overflow-x:auto}.admin-table{width:100%;border-collapse:collapse;white-space:nowrap;text-align:left}.admin-table th{background:#fafbfc;color:#788497;font-size:9px;letter-spacing:.7px;text-transform:uppercase;padding:14px 16px}.admin-table td{padding:15px 16px;border-top:1px solid #edf0f4;font-size:11px;color:#445166}.admin-table td:first-child b{display:block;color:#17243b}.admin-table td:first-child small{display:block;margin-top:5px;color:#8a95a4;font-size:10px}.admin-table td span:not(.admin-demo-status){color:#f47735}.admin-demo-status{display:inline-block;padding:6px 8px;background:#fff2e8;border-radius:6px;color:#a34c1b;font-size:9px;font-weight:800}
        .admin-empty{display:flex;align-items:center;flex-direction:column;text-align:center;padding:38px 18px;color:#7c8797}.admin-empty>svg{color:#f47735;margin-bottom:10px}.admin-empty>b{color:#17243b;font-size:13px}.admin-empty p{font-size:11px;line-height:1.7;max-width:390px}.admin-home-cta{margin-top:6px;display:inline-block;text-decoration:none;background:#17243b;color:#fff;padding:11px 15px;border-radius:8px;font-size:11px;font-weight:800}.admin-demo-footnote{font-size:10px;color:#8b95a4;line-height:1.7;margin-top:16px}
        @media(max-width:700px){.admin-demo-header{height:66px;padding:0 16px}.admin-demo-brand small{display:none}.admin-demo-content{padding:30px 15px 45px}.admin-demo-title-row{align-items:flex-start}.admin-stat-grid{grid-template-columns:1fr;gap:10px}.admin-stat-grid article{padding:15px;display:grid;grid-template-columns:36px 1fr;column-gap:11px;align-items:center}.admin-stat-grid article>span{grid-row:span 3}.admin-stat-grid strong{font-size:23px}.admin-panel-head{align-items:stretch;flex-direction:column;padding:16px}.admin-search{max-width:none}.admin-demo-warning{padding:12px}.admin-demo-brand>b{font-size:19px}}
      `}</style>
    </main>
  );
}
