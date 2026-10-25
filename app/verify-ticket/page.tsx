"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, BusFront, CircleAlert, LoaderCircle, ShieldCheck } from "lucide-react";

type Verification = {
  reference: string; status: string; valid: boolean; confirmedAt: string | null;
  busLabel: string | null; departureAt: string | null; arrivalAt: string | null;
  origin: string | null; destination: string | null;
};

export default function VerifyTicketPage() {
  const [ticket, setTicket] = useState<Verification | null>(null);
  const [message, setMessage] = useState("Checking ticket status…");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const reference = new URLSearchParams(window.location.search).get("reference") || "";
    if (!reference) { setMessage("No booking reference was supplied."); setLoading(false); return; }
    fetch("/api/tickets/verify?reference=" + encodeURIComponent(reference), { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok || !payload.ok) throw new Error(payload.error === "ticket_not_found" ? "Ticket reference not found." : "Could not verify this ticket. Try again later.");
        setTicket(payload.ticket as Verification);
        setMessage(payload.message || "Verification complete.");
      })
      .catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not verify this ticket."))
      .finally(() => setLoading(false));
  }, []);
  const date = (value: string | null) => value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Not available";
  return <main className="verify-page">
    <header className="verify-brand"><span className="brand-mark"><BusFront size={22} /></span><span className="brand-copy"><strong>hepra<span>bus</span></strong><small>TICKET VERIFICATION</small></span></header>
    <section className="verify-card">
      <div className={ticket?.valid ? "verify-status verified" : "verify-status not-verified"}>{loading ? <LoaderCircle className="verify-spin" size={26} /> : ticket?.valid ? <BadgeCheck size={28} /> : <CircleAlert size={28} />}</div>
      <span className="section-overline">HEPRA BUS · OFFICIAL STATUS CHECK</span>
      <h1>{loading ? "Verifying ticket" : ticket?.valid ? "Booking confirmed" : "Not a confirmed ticket"}</h1>
      <p className="verify-message">{message}</p>
      {ticket && <><div className="verify-reference"><small>BOOKING REFERENCE</small><strong>{ticket.reference}</strong></div><div className="verify-route"><div><small>FROM</small><strong>{ticket.origin || "—"}</strong></div><span>→</span><div><small>TO</small><strong>{ticket.destination || "—"}</strong></div></div><div className="verify-grid"><span>Booking status<b>{ticket.status.replace(/_/g, " ")}</b></span><span>Bus<b>{ticket.busLabel || "—"}</b></span><span>Departure<b>{date(ticket.departureAt)}</b></span><span>Arrival<b>{date(ticket.arrivalAt)}</b></span>{ticket.valid && ticket.confirmedAt && <span>Confirmed at<b>{date(ticket.confirmedAt)}</b></span>}</div></>}
      <p className="verify-privacy"><ShieldCheck size={15} /> This verification page does not display passenger names, phone numbers or payment details.</p>
      <a className="verify-home" href="/">Return to HEPRA BUS</a>
    </section>
  </main>;
}
