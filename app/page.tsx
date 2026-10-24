"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownUp, ArrowRight, BadgeCheck, BusFront, CalendarDays, Check,
  ChevronRight, Clock3, Headphones, MapPin, Menu, Search, ShieldCheck,
  Sparkles, Ticket, Wallet, X, Armchair, UserRound, Phone, CreditCard
} from "lucide-react";

const cities = ["Chennai", "Bengaluru", "Coimbatore", "Madurai", "Tiruchirappalli", "Hyderabad", "Kochi", "Mumbai"];
const routes = [
  { from: "Chennai", to: "Bengaluru", fare: 699, time: "6h 15m", depart: "10:30 PM", arrive: "4:45 AM", tag: "Popular", art: "city" },
  { from: "Chennai", to: "Coimbatore", fare: 449, time: "7h 00m", depart: "9:45 PM", arrive: "4:45 AM", tag: "Best value", art: "hills" },
  { from: "Chennai", to: "Madurai", fare: 529, time: "7h 30m", depart: "10:00 PM", arrive: "5:30 AM", tag: "Popular", art: "temple" },
  { from: "Bengaluru", to: "Chennai", fare: 649, time: "6h 20m", depart: "11:00 PM", arrive: "5:20 AM", tag: "Top route", art: "city" },
  { from: "Chennai", to: "Tiruchirappalli", fare: 399, time: "5h 45m", depart: "10:15 PM", arrive: "4:00 AM", tag: "Best value", art: "green" },
  { from: "Coimbatore", to: "Bengaluru", fare: 579, time: "6h 40m", depart: "10:00 PM", arrive: "4:40 AM", tag: "Popular", art: "hills" },
];
function localDate(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
const formatFare = (fare: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(fare);

type LiveTrip = {
  id: string;
  busLabel: string;
  busType: string;
  departureAt: string;
  arrivalAt: string;
  farePaise: number;
  currency: string;
  route: {
    origin_city: string;
    destination_city: string;
    origin_stop: string | null;
    destination_stop: string | null;
  } | {
    origin_city: string;
    destination_city: string;
    origin_stop: string | null;
    destination_stop: string | null;
  }[];
};

type BookingStatusResult = {
  reference: string;
  status: string;
  totalPaise: number;
  expiresAt: string | null;
  confirmedAt: string | null;
  paymentIntegrated: boolean;
  passengers: { name: string; seat: string | null; farePaise: number }[];
  trip: {
    bus_label: string;
    bus_type: string;
    departure_at: string;
    arrival_at: string;
    routes: {
      origin_city: string;
      destination_city: string;
      origin_stop: string | null;
      destination_stop: string | null;
    } | {
      origin_city: string;
      destination_city: string;
      origin_stop: string | null;
      destination_stop: string | null;
    }[] | null;
  } | null;
};

export default function Home() {
  const [from, setFrom] = useState("Chennai");
  const [to, setTo] = useState("Bengaluru");
  const [date, setDate] = useState(localDate(1));
  const [passengers, setPassengers] = useState("1");
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [liveTrips, setLiveTrips] = useState<LiveTrip[]>([]);
  const [liveSearchLoading, setLiveSearchLoading] = useState(false);
  const [liveSearchMessage, setLiveSearchMessage] = useState("");
  const [liveSort, setLiveSort] = useState<"departure" | "fare">("departure");
  const [acOnly, setAcOnly] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<(typeof routes)[number] | null>(null);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [passengerName, setPassengerName] = useState("");
  const [passengerPhone, setPassengerPhone] = useState("");
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [bookingReference, setBookingReference] = useState("");
  const [bookingError, setBookingError] = useState("");
  const [tripLookupReference, setTripLookupReference] = useState("");
  const [tripLookupPhone, setTripLookupPhone] = useState("");
  const [tripLookupResult, setTripLookupResult] = useState<BookingStatusResult | null>(null);
  const [tripLookupError, setTripLookupError] = useState("");

  const matchingRoutes = useMemo(
    () => routes.filter((route) => route.from === from && route.to === to),
    [from, to]
  );

  const filteredLiveTrips = useMemo(() => {
    const trips = liveTrips.filter((trip) => !acOnly || /\bac\b/i.test(trip.busType));
    return [...trips].sort((a, b) => liveSort === "fare"
      ? a.farePaise - b.farePaise
      : new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime());
  }, [liveTrips, liveSort, acOnly]);

  async function searchBuses() {
    if (from === to) {
      setError("Choose two different cities to find your journey.");
      setSearched(false);
      return;
    }
    if (!date || date < localDate()) {
      setError("Please choose today or a future journey date.");
      setSearched(false);
      return;
    }
    setError("");
    setLiveSearchMessage("");
    setLiveTrips([]);
    setLiveSearchLoading(true);
    setSelectedRoute(null);
    setSelectedSeats([]);
    setBookingConfirmed(false);
    setSearched(true);
    document.getElementById("search-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
    try {
      const params = new URLSearchParams({ origin: from, destination: to, date });
      const response = await fetch(`/api/trips/search?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        setLiveSearchMessage("Live schedules are temporarily unavailable. The sample route previews below are not bookable.");
        return;
      }
      const trips = Array.isArray(payload.trips) ? payload.trips as LiveTrip[] : [];
      setLiveTrips(trips);
      setLiveSearchMessage(trips.length
        ? "Live inventory results from the database. Booking and seat holds are not enabled yet."
        : "No live trips are listed for this route and date yet. Sample previews below are for design only and cannot be booked.");
    } catch {
      setLiveSearchMessage("Could not reach live trip search. Sample route previews below are not bookable.");
    } finally {
      setLiveSearchLoading(false);
    }
  }

  function selectRoute(route: (typeof routes)[number]) {
    setFrom(route.from);
    setTo(route.to);
    setSelectedRoute(null);
    setSelectedSeats([]);
    setBookingConfirmed(false);
    setSearched(true);
    setError("");
    document.getElementById("booking-search")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <main>
      <div className="announcement"><Sparkles size={14} /> Your next adventure starts here <span>Thoughtful travel. Better journeys.</span></div>
      <header className="site-header">
        <div className="nav-wrap">
          <a className="brand" href="#" aria-label="HepraBus home">
            <span className="brand-mark"><BusFront size={23} strokeWidth={2.4} /></span>
            <span className="brand-copy"><strong>hepra<span>bus</span></strong><small>YOUR JOURNEY, SIMPLIFIED</small></span>
          </a>
          <nav className={mobileMenu ? "main-nav open" : "main-nav"} aria-label="Main navigation">
            <a className="active" href="#">Home</a><a href="#routes">Bus routes</a><a href="#offers">Offers</a><a href="#why-us">Why HepraBus</a>
          </nav>
          <div className="nav-actions"><a className="my-trips" href="#my-trips"><Ticket size={17} /> My trips</a><button className="menu-toggle" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}>{mobileMenu ? <X /> : <Menu />}</button></div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-glow glow-one" /><div className="hero-glow glow-two" />
        <div className="hero-inner">
          <div className="hero-copy">
            <div className="eyebrow light"><span className="eyebrow-dot" /> THE BETTER WAY TO GET THERE</div>
            <h1>Good journeys.<br /><em>Great stories.</em></h1>
            <p>From quick getaways to long-awaited reunions, make every mile feel a little easier.</p>
            <div className="hero-points"><span><ShieldCheck size={17} /> Secure journey</span><span><BadgeCheck size={17} /> Trusted operators</span><span><Ticket size={17} /> Easy e-tickets</span></div>
          </div>
          <div className="hero-visual" aria-hidden="true"><div className="sun-disc" /><div className="road road-back" /><div className="road road-front" /><div className="illustration-bus"><div className="bus-windows"><i /><i /><i /></div><div className="bus-front"><span /></div><div className="bus-wheels"><i /><i /></div></div><div className="visual-label"><span className="visual-label-icon"><MapPin size={16} /></span><span><b>Next stop: somewhere wonderful</b><small>Make the journey yours</small></span></div></div>
        </div>
        <div className="hero-bottom"><span>MADE FOR THE WAY YOU TRAVEL</span><span className="hero-bottom-line" /><span>INDIA, ONE JOURNEY AT A TIME</span></div>
      </section>

      <section className="booking-shell" id="booking-search">
        <div className="booking-heading"><div><span className="section-overline">PLAN YOUR JOURNEY</span><h2>Where would you like to go?</h2></div><span className="one-way">ONE WAY <ChevronRight size={14} /></span></div>
        <div className="booking-fields">
          <label className="field"><span>FROM</span><div className="field-control"><MapPin size={19} /><select value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Departure city">{cities.map((city) => <option key={city}>{city}</option>)}</select></div></label>
          <button className="swap-button" aria-label="Swap departure and destination" onClick={() => { setFrom(to); setTo(from); setError(""); }}><ArrowDownUp size={18} /></button>
          <label className="field"><span>TO</span><div className="field-control"><MapPin size={19} /><select value={to} onChange={(e) => setTo(e.target.value)} aria-label="Destination city">{cities.map((city) => <option key={city}>{city}</option>)}</select></div></label>
          <label className="field"><span>JOURNEY DATE</span><div className="field-control"><CalendarDays size={19} /><input type="date" value={date} min={localDate()} onChange={(e) => setDate(e.target.value)} aria-label="Journey date" /></div></label>
          <label className="field passenger-field"><span>PASSENGERS</span><div className="field-control"><Ticket size={19} /><select value={passengers} onChange={(e) => setPassengers(e.target.value)} aria-label="Number of passengers">{[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {n === 1 ? "passenger" : "passengers"}</option>)}</select></div></label>
          <button className="search-button" onClick={searchBuses}><Search size={18} /> Search buses <ArrowRight size={17} /></button>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="booking-foot"><span><Check size={14} /> No hidden charges</span><span><Check size={14} /> Simple booking experience</span><span><Check size={14} /> Travel on your terms</span></div>
      </section>

      {searched && <section className="results-section" id="search-results"><div className="results-heading"><div><span className="section-overline">YOUR SEARCH</span><h2>{from} <ArrowRight size={21} /> {to}</h2><p>{date} · {passengers} passenger{passengers === "1" ? "" : "s"}</p></div><span className="demo-pill">{liveTrips.length ? "Live database" : "Preview results"}</span></div>{liveSearchLoading && <div className="empty-results"><BusFront size={27} /><div><b>Checking available trips…</b><p>Searching the trip inventory for your selected route and date.</p></div></div>}{!liveSearchLoading && liveTrips.length > 0 && <><div className="live-filter-bar"><label><input type="checkbox" checked={acOnly} onChange={(event) => setAcOnly(event.target.checked)} /> AC buses only</label><label>Sort by <select value={liveSort} onChange={(event) => setLiveSort(event.target.value as "departure" | "fare")}><option value="departure">Departure time</option><option value="fare">Lowest fare</option></select></label><span>{filteredLiveTrips.length} live trip{filteredLiveTrips.length === 1 ? "" : "s"}</span></div>{filteredLiveTrips.length ? <div className="results-grid">{filteredLiveTrips.map((trip) => { const route = Array.isArray(trip.route) ? trip.route[0] : trip.route; return <article className="result-card" key={trip.id}><div className="result-top"><span>{trip.busType || "Bus service"}</span><small>Live listing</small></div><div className="result-times"><div><b>{new Date(trip.departureAt).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"})}</b><small>{route?.origin_stop || route?.origin_city || from}</small></div><div className="duration"><span /><small><Clock3 size={13} /> {Math.max(0, Math.round((new Date(trip.arrivalAt).getTime() - new Date(trip.departureAt).getTime()) / 60000 / 60))}h approx.</small></div><div className="align-right"><b>{new Date(trip.arrivalAt).toLocaleTimeString("en-IN", {hour:"2-digit",minute:"2-digit"})}</b><small>{route?.destination_stop || route?.destination_city || to}</small></div></div><div className="result-bottom"><span>Fare <strong>{formatFare(Math.round(trip.farePaise / 100))}</strong></span><span className="sample-note">Not bookable yet</span></div><button className="choose-seats-button" disabled><Armchair size={16} /> Booking coming soon <ArrowRight size={15} /></button></article>; })}</div> : <div className="empty-results"><BusFront size={27} /><div><b>No trips match these filters.</b><p>Turn off the AC-only filter or change the sort option.</p></div></div>}</>}{!liveSearchLoading && liveTrips.length === 0 && <div className="empty-results"><BusFront size={27} /><div><b>{liveSearchMessage || "No live trips found for this route and date."}</b><p>Sample schedules below are illustrative only; they do not reserve seats or issue tickets.</p></div></div>}{!liveSearchLoading && matchingRoutes.length > 0 && <><div className="results-heading" style={{marginTop: "24px"}}><div><span className="section-overline">DESIGN PREVIEW</span><p>Illustrative sample schedules — not connected to live inventory</p></div><span className="demo-pill">Demo only</span></div><div className="results-grid">{matchingRoutes.map((route) => <article className="result-card" key={"sample-" + route.from + route.to}><div className="result-top"><span>{route.tag}</span><small>Sample fare</small></div><div className="result-times"><div><b>{route.depart}</b><small>{route.from}</small></div><div className="duration"><span /><small><Clock3 size={13} /> {route.time}</small></div><div className="align-right"><b>{route.arrive}</b><small>{route.to}</small></div></div><div className="result-bottom"><span>Starting from <strong>{formatFare(route.fare)}</strong></span><span className="sample-note">Demo only</span></div><button className="choose-seats-button" onClick={() => { setSelectedRoute(route); setSelectedSeats([]); setBookingConfirmed(false); setBookingError(""); setPassengerName(""); setPassengerPhone(""); setTimeout(() => document.getElementById("seat-selection")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}><Armchair size={16} /> Choose seats <ArrowRight size={15} /></button></article>)}</div></>}{!liveSearchLoading && matchingRoutes.length === 0 && liveTrips.length === 0 && <div className="empty-results"><BusFront size={27} /><div><b>No matching sample route.</b><p>Live search is checked separately above; sample previews are available only for selected popular routes.</p></div></div>}</section>}


      {selectedRoute && <section className="seat-section" id="seat-selection"><div className="seat-section-head"><div><span className="section-overline">STEP 2 OF 3 · SEAT SELECTION</span><h2>Make yourself comfortable.</h2><p>{selectedRoute.from} to {selectedRoute.to} · {date} · Sample schedule {selectedRoute.depart}</p></div><button className="text-button" onClick={() => { setSelectedRoute(null); setSelectedSeats([]); }}>Change route <X size={15} /></button></div>
        {bookingConfirmed ? <div className="confirmation-card"><div className="confirmation-icon"><Check size={28} /></div><span className="section-overline">DEMO BOOKING COMPLETE</span><h3>Your sample journey is ready.</h3><p>This is only a frontend preview. No ticket was issued and no payment was taken.</p><div className="confirmation-summary"><span>Demo reference <b>{bookingReference || "HB-DEMO"}</b></span><span>Route <b>{selectedRoute.from} → {selectedRoute.to}</b></span><span>Passenger <b>{passengerName}</b></span><span>Seats <b>{selectedSeats.join(", ")}</b></span><span>Sample total <b>{formatFare(selectedRoute.fare * selectedSeats.length)}</b></span></div><div className="confirmation-actions"><button className="search-button" onClick={() => window.print()}><Ticket size={16} /> Print demo ticket</button><button className="secondary-ticket-button" onClick={() => { setBookingConfirmed(false); setSelectedRoute(null); setSelectedSeats([]); setSearched(false); document.getElementById("booking-search")?.scrollIntoView({ behavior: "smooth" }); }}>Plan another trip <ArrowRight size={16} /></button></div></div> : <div className="seat-layout"><div className="seat-map-card"><div className="seat-map-top"><div><b>Choose your seats</b><small>Front of bus</small></div><div className="driver-mark"><BusFront size={20} /><span>DRIVER</span></div></div><div className="seat-legend"><span><i className="legend-available" /> Available</span><span><i className="legend-selected" /> Selected</span><span><i className="legend-occupied" /> Unavailable</span></div><div className="bus-seat-map"><div className="seat-columns"><span>A</span><span>B</span><span className="aisle-space" /><span>C</span><span>D</span></div>{Array.from({ length: 6 }, (_, rowIndex) => <div className="seat-row" key={rowIndex}>{["A", "B", "", "C", "D"].map((column, colIndex) => { const aisle = column === ""; const seat = aisle ? "" : `${column}${rowIndex + 1}`; const occupied = ["A2", "D2", "B4", "C5", "D5"].includes(seat); return <span className={aisle ? "seat-cell aisle" : "seat-cell"} key={aisle ? "aisle" : seat}>{aisle ? null : <button type="button" disabled={occupied} aria-pressed={selectedSeats.includes(seat)} aria-label={`Seat ${seat}${occupied ? ", unavailable" : ""}`} className={`seat ${occupied ? "occupied" : selectedSeats.includes(seat) ? "selected" : "available"}`} onClick={() => { setBookingError(""); setSelectedSeats((current) => current.includes(seat) ? current.filter((item) => item !== seat) : current.length < Number(passengers) ? [...current, seat] : current); }}>{seat}</button>}</span>; })}</div>)}</div><p className="seat-map-note">Illustrative seat map only. Actual seat layouts and availability may differ.</p></div>
        <form className="passenger-card" onSubmit={(event) => { event.preventDefault(); if (selectedSeats.length !== Number(passengers)) { setBookingError(`Please select exactly ${passengers} seat${passengers === "1" ? "" : "s"}.`); return; } if (!passengerName.trim() || !/^[6-9][0-9]{9}$/.test(passengerPhone.trim())) { setBookingError("Enter the passenger name and a valid 10-digit Indian mobile number."); return; } setBookingError(""); const reference = `HB-DEMO-${Date.now().toString().slice(-8)}`; setBookingReference(reference); const demoBooking = { reference, from: selectedRoute.from, to: selectedRoute.to, date, name: passengerName.trim(), phone: passengerPhone.trim(), seats: selectedSeats.join(", "), total: String(selectedRoute.fare * selectedSeats.length), status: "Demo only — not ticketed" }; try { const saved = JSON.parse(window.localStorage.getItem("heprabus-demo-bookings") || "[]"); window.localStorage.setItem("heprabus-demo-bookings", JSON.stringify([demoBooking, ...saved.filter((item: { reference?: string }) => item.reference !== reference)].slice(0, 20))); } catch { /* Storage may be unavailable; confirmation still works for this session. */ } setBookingConfirmed(true); document.getElementById("seat-selection")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}><span className="section-overline">PASSENGER DETAILS</span><h3>Who’s travelling?</h3><label className="form-field"><span>FULL NAME</span><div><UserRound size={17} /><input required maxLength={80} value={passengerName} onChange={(event) => setPassengerName(event.target.value)} placeholder="Passenger name" autoComplete="name" /></div></label><label className="form-field"><span>MOBILE NUMBER</span><div><Phone size={17} /><span className="country-code">+91</span><input required inputMode="numeric" maxLength={10} value={passengerPhone} onChange={(event) => setPassengerPhone(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" autoComplete="tel-national" /></div></label><div className="fare-summary"><span>Fare per seat <b>{formatFare(selectedRoute.fare)}</b></span><span>Selected seats <b>{selectedSeats.length} / {passengers}</b></span><div><span>Sample total</span><strong>{formatFare(selectedRoute.fare * selectedSeats.length)}</strong></div></div>{bookingError && <p className="form-error" role="alert">{bookingError}</p>}<button className="search-button" type="submit"><CreditCard size={17} /> Preview booking <ArrowRight size={16} /></button><p className="demo-disclaimer"><ShieldCheck size={14} /> Demo only. No real booking or payment is made.</p></form></div>}
      </section>}

      <section className="my-trips-section" id="my-trips"><div className="my-trips-heading"><span className="section-overline">YOUR JOURNEY, AT A GLANCE</span><h2>Look up your booking.</h2><p>Enter your booking reference and the registered mobile number to check the current database status.</p></div><form className="trip-lookup-form" onSubmit={async (event) => { event.preventDefault(); setTripLookupError(""); setTripLookupResult(null); try { const response = await fetch("/api/bookings/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reference: tripLookupReference.trim(), phone: tripLookupPhone.trim() }) }); const payload = await response.json(); if (!response.ok || !payload.ok) { setTripLookupError(response.status === 404 ? "No booking found for that reference and mobile number." : payload.error === "invalid_reference" ? "Enter a valid booking reference." : payload.error === "invalid_phone" ? "Enter a valid 10-digit mobile number." : "Booking lookup is temporarily unavailable."); return; } setTripLookupResult(payload.booking as BookingStatusResult); } catch { setTripLookupError("Unable to reach booking service. Please try again."); } }}><label><span>BOOKING REFERENCE</span><input required value={tripLookupReference} onChange={(event) => setTripLookupReference(event.target.value.toUpperCase())} placeholder="HB-XXXXXXXXXXXX" /></label><label><span>REGISTERED MOBILE NUMBER</span><input required inputMode="numeric" maxLength={10} value={tripLookupPhone} onChange={(event) => setTripLookupPhone(Array.from(event.target.value).filter((character) => character >= "0" && character <= "9").join("").slice(0, 10))} placeholder="10-digit mobile number" /></label><button className="search-button" type="submit"><Search size={17} /> Find booking</button></form>{tripLookupError && <p className="form-error" role="alert">{tripLookupError}</p>}{tripLookupResult && <div className="trip-lookup-result"><div className="trip-lookup-result-head"><span className="confirmation-icon"><Check size={20} /></span><div><span className="section-overline">BOOKING RECORD FOUND</span><h3>{tripLookupResult.reference}</h3></div><span className="demo-pill">{tripLookupResult.status}</span></div><div className="trip-lookup-grid"><span>Total fare<b>{formatFare(Number(tripLookupResult.totalPaise || 0) / 100)}</b></span><span>Hold expires<b>{tripLookupResult.expiresAt ? new Date(tripLookupResult.expiresAt).toLocaleString() : "—"}</b></span><span>Passengers<b>{Array.isArray(tripLookupResult.passengers) ? tripLookupResult.passengers.map((p: { name?: string }) => p.name).join(", ") : "—"}</b></span><span>Seats<b>{Array.isArray(tripLookupResult.passengers) ? tripLookupResult.passengers.map((p: { seat?: string }) => p.seat || "—").join(", ") : "—"}</b></span><span>Departure<b>{tripLookupResult.trip?.departure_at ? new Date(tripLookupResult.trip.departure_at).toLocaleString() : "—"}</b></span><span>Payment<b>Not integrated</b></span></div><p>A pending booking is only a temporary seat hold. It is not a confirmed ticket.</p></div>}</section>

      <section className="trust-strip" id="why-us"><div className="trust-item"><span><ShieldCheck /></span><div><b>Travel with confidence</b><small>Clarity at every step</small></div></div><div className="trust-item"><span><Wallet /></span><div><b>Fair, clear fares</b><small>Know what to expect</small></div></div><div className="trust-item"><span><Headphones /></span><div><b>Help when you need it</b><small>Support made simple</small></div></div><div className="trust-item"><span><BadgeCheck /></span><div><b>Made for real life</b><small>Booking without the fuss</small></div></div></section>

      <section className="routes-section" id="routes"><div className="section-heading"><div><span className="section-overline">PICK YOUR NEXT DESTINATION</span><h2>Popular routes</h2><p>Start with a favourite. See where the road takes you.</p></div><a href="#booking-search">Plan a trip <ArrowRight size={17} /></a></div><div className="route-grid">{routes.map((route, index) => <button className="route-card" key={route.from + route.to} onClick={() => selectRoute(route)}><div className={"route-art " + route.art}><span className="route-number">0{index + 1}</span><span className="route-art-icon">{route.art === "hills" ? "⌁" : route.art === "temple" ? "⌂" : route.art === "green" ? "✳" : "◉"}</span><span className="route-art-caption">YOUR NEXT CHAPTER</span></div><div className="route-card-body"><div className="route-names"><b>{route.from}</b><span><ArrowRight size={15} /></span><b>{route.to}</b></div><div className="route-meta"><span>Sample fare from</span><strong>{formatFare(route.fare)}</strong></div><div className="route-card-footer"><span>{route.tag}</span><span className="route-cta">View route <ChevronRight size={15} /></span></div></div></button>)}</div></section>

      <section className="offer-section" id="offers"><div className="offer-copy"><span className="section-overline light-overline">A LITTLE MORE REASON TO GO</span><h2>Say yes to<br />the <em>next trip.</em></h2><p>Discover a new place, revisit your favourite, or just take the scenic route.</p><div className="offer-code"><span>YOUR TRAVEL MOOD</span><b>GO SOMEWHERE</b><Sparkles size={17} /></div></div><div className="offer-art" aria-hidden="true"><div className="offer-sun" /><div className="offer-mountain mountain-a" /><div className="offer-mountain mountain-b" /><div className="offer-road" /><div className="offer-stamp">TAKE<br />THE<br />LONG WAY</div></div></section>

      <section className="help-section" id="help"><div className="help-icon"><Headphones size={24} /></div><div><span className="section-overline">HERE WHEN YOU NEED US</span><h2>Travel should feel simple.</h2><p>We're building a smoother way to plan your trip. Booking, payment and live support features will be connected as the platform grows.</p></div><a href="mailto:hello@heprabus.example">Contact the team <ArrowRight size={17} /></a></section>

      <footer className="site-footer"><div className="footer-main"><a className="brand footer-brand" href="#"><span className="brand-mark"><BusFront size={22} /></span><span className="brand-copy"><strong>hepra<span>bus</span></strong><small>YOUR JOURNEY, SIMPLIFIED</small></span></a><p>Thoughtful travel starts with a simpler way to get there.</p><div className="footer-links"><a href="#routes">Popular routes</a><a href="#offers">Offers</a><a href="#why-us">Why HepraBus</a><a href="#help">Help</a></div></div><div className="footer-bottom"><span>© 2026 HepraBus. All rights reserved.</span><span>Website prototype · Live inventory and ticketing are not connected.</span></div></footer>
    </main>
  );
}
