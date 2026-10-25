"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { AlertTriangle, ArrowLeft, BusFront, Camera, CameraOff, CheckCircle2, Search, ShieldCheck, XCircle } from "lucide-react";

type TicketResult = {
  reference: string; status: string; valid: boolean; confirmedAt: string | null;
  busLabel: string | null; departureAt: string | null; arrivalAt: string | null;
  origin: string | null; destination: string | null;
};
type QRDetector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>> };
type QRWindow = Window & { BarcodeDetector?: new (options?: { formats: string[] }) => QRDetector };
const card: CSSProperties = { background: "#fff", border: "1px solid #e5e9f0", borderRadius: 18, padding: 20, boxShadow: "0 12px 35px #17243a0a" };
const label: CSSProperties = { display: "block", color: "#748096", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 6 };
const value: CSSProperties = { color: "#17243a", fontSize: 15, fontWeight: 750, overflowWrap: "anywhere" };

function date(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "—" : parsed.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
function extractReference(raw: string) {
  const direct = raw.trim().toUpperCase().match(/HB-[A-F0-9]{12}/);
  if (direct) return direct[0];
  try {
    const parsed = new URL(raw);
    return (parsed.searchParams.get("reference") || "").trim().toUpperCase().match(/^HB-[A-F0-9]{12}$/)?.[0] || "";
  } catch { return ""; }
}

export default function StaffVerificationPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [authBusy, setAuthBusy] = useState(true);
  const [authMessage, setAuthMessage] = useState("");
  const [reference, setReference] = useState("");
  const [result, setResult] = useState<TicketResult | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/staff-session", { cache: "no-store" }).then(r => r.json())
      .then(data => { if (active) setAuthenticated(Boolean(data.ok)); })
      .catch(() => { if (active) setAuthenticated(false); })
      .finally(() => { if (active) setAuthBusy(false); });
    return () => { active = false; };
  }, []);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setAuthBusy(true); setAuthMessage("");
    try {
      const response = await fetch("/api/admin/staff-login", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        setAuthenticated(false);
        setAuthMessage(data.error === "staff_auth_not_configured"
          ? "Staff login is not configured on the server. Add the required environment variables."
          : "Login failed. Check your username and password.");
      } else {
        setAuthenticated(true); setPassword(""); setAuthMessage("Signed in. Your session expires after 8 hours.");
      }
    } catch { setAuthMessage("Network error. Please try again."); }
    finally { setAuthBusy(false); }
  }

  async function logout() {
    setAuthBusy(true);
    try { await fetch("/api/admin/staff-logout", { method: "POST", cache: "no-store" }); }
    finally { setAuthenticated(false); setResult(null); setMessage(""); setCameraOn(false); setAuthBusy(false); }
  }

  useEffect(() => {
    if (!cameraOn || !authenticated) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let frame = 0;
    let detector: QRDetector | null = null;
    async function startScanner() {
      try {
        const Detector = (window as QRWindow).BarcodeDetector;
        if (!Detector) {
          setCameraMessage("This browser does not support built-in QR scanning. Use Chrome on Android or enter the reference manually.");
          setCameraOn(false); return;
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          setCameraMessage("Camera access requires HTTPS and a supported browser."); setCameraOn(false); return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        detector = new Detector({ formats: ["qr_code"] });
        setCameraMessage("Point the rear camera at the ticket QR code.");
        const scan = async () => {
          if (stopped || !videoRef.current || !detector) return;
          try {
            if (videoRef.current.readyState >= 2) {
              const codes = await detector.detect(videoRef.current);
              const found = codes.map(code => extractReference(code.rawValue)).find(Boolean);
              if (found) {
                setReference(found); setCameraMessage("QR captured. Tap Verify ticket to check its live booking status.");
                setCameraOn(false); return;
              }
            }
          } catch { /* Continue scanning if a frame cannot be decoded. */ }
          if (!stopped) frame = requestAnimationFrame(scan);
        };
        frame = requestAnimationFrame(scan);
      } catch {
        setCameraMessage("Camera permission was denied or the camera is unavailable. Allow camera access or enter the reference manually.");
        setCameraOn(false);
      }
    }
    void startScanner();
    return () => {
      stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [cameraOn, authenticated]);

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setResult(null); setMessage("");
    try {
      const response = await fetch("/api/admin/tickets/verify", {
        method: "POST", cache: "no-store", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const data = await response.json();
      if (response.status === 401) { setAuthenticated(false); setMessage("Your staff session expired. Please sign in again."); }
      else {
        if (data.ticket) setResult(data.ticket as TicketResult);
        setMessage(data.message || (data.error === "invalid_reference" ? "Enter a valid HEPRA BUS reference." : "Verification could not be completed."));
      }
    } catch { setMessage("Network error. Check your connection and try again."); }
    finally { setBusy(false); }
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
        {authBusy && <p role="status" style={{ color: "#68758a", fontSize: 13 }}>Checking staff session…</p>}
        {!authenticated && !authBusy && <form onSubmit={login} style={{ display: "grid", gap: 14 }}>
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 800, color: "#536277" }}>STAFF USERNAME
            <input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" required maxLength={120} placeholder="Staff username" style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #dce3ec", background: "#fff" }}/>
          </label>
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 800, color: "#536277" }}>PASSWORD
            <input value={password} onChange={e => setPassword(e.target.value)} type="password" autoComplete="current-password" required maxLength={256} placeholder="Staff password" style={{ width: "100%", boxSizing: "border-box", padding: 13, borderRadius: 11, border: "1px solid #dce3ec", background: "#fff" }}/>
          </label>
          <button disabled={authBusy} type="submit" style={{ border: 0, borderRadius: 11, padding: 14, background: "#17243a", color: "#fff", fontWeight: 850 }}>Sign in to staff tools</button>
        </form>}
        {authMessage && <p role="status" style={{ color: authenticated ? "#187544" : "#a12c35", fontSize: 12 }}>{authMessage}</p>}
        {authenticated && <form onSubmit={verify} style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, background: "#effbf4", borderRadius: 10, padding: 12 }}>
            <span style={{ color: "#187544", fontSize: 12, fontWeight: 800 }}>Signed in · secure 8-hour session</span>
            <button type="button" onClick={logout} style={{ border: "1px solid #b8e7cd", borderRadius: 8, padding: "7px 10px", background: "#fff", color: "#187544", fontWeight: 800 }}>Log out</button>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <button type="button" onClick={() => { setCameraMessage(""); setCameraOn(v => !v); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: "1px solid #d8d1f3", borderRadius: 11, padding: 13, background: "#f7f4ff", color: "#5b2bbb", fontWeight: 850 }}>
              {cameraOn ? <CameraOff size={18}/> : <Camera size={18}/>} {cameraOn ? "Stop camera scanner" : "Scan ticket QR with camera"}
            </button>
            {cameraOn && <video ref={videoRef} muted playsInline aria-label="Camera view for scanning ticket QR" style={{ display: "block", width: "100%", maxHeight: 320, objectFit: "cover", background: "#101827", borderRadius: 12 }}/>}
            {cameraMessage && <p role="status" style={{ margin: 0, color: "#68758a", fontSize: 12, lineHeight: 1.5 }}>{cameraMessage}</p>}
          </div>
          <label style={{ display: "grid", gap: 7, fontSize: 12, fontWeight: 800, color: "#536277" }}>BOOKING REFERENCE
            <input value={reference} onChange={e => setReference(e.target.value.toUpperCase())} required maxLength={15} autoCapitalize="characters" placeholder="HB-XXXXXXXXXXXX" style={{ width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 11, border: "1px solid #dce3ec", fontSize: 18, letterSpacing: ".05em", fontWeight: 800 }}/>
          </label>
          <button disabled={busy} type="submit" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 9, border: 0, borderRadius: 11, padding: 14, background: "#6b35d5", color: "#fff", fontWeight: 850 }}>{busy ? "Checking ticket…" : <><Search size={17}/> Verify ticket</>}</button>
        </form>}
      </div>
      {message && <div role="status" style={{ ...card, marginBottom: 16, borderColor: result?.valid ? "#b8e7cd" : "#f1c8c8", background: result?.valid ? "#effbf4" : "#fff7f7" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 850, color: result?.valid ? "#187544" : "#a12c35" }}>{result?.valid ? <CheckCircle2 size={22}/> : <AlertTriangle size={22}/>} {message}</div>
      </div>}
      {result && authenticated && <section style={{ ...card, border: result.valid ? "2px solid #25a467" : "2px solid #d84b55" }}>
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
      <footer style={{ textAlign: "center", color: "#8993a3", fontSize: 11, marginTop: 24 }}><BusFront size={15} style={{ verticalAlign: "middle", marginRight: 5 }}/> Internal staff tool · Sign out on shared devices</footer>
    </div>
  </main>;
}
