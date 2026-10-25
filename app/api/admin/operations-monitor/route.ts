import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../../lib/supabase-admin";
import { verifyStaffSession } from "../../../../../lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" },
});

export async function GET(request: NextRequest) {
  if (!verifyStaffSession(request)) return json({ ok: false, error: "unauthorized" }, 401);
  const now = new Date().toISOString();
  try {
    const db = getSupabaseAdmin();
    const [
      pending, expiredPending, confirmed, succeededPayments, openCases,
      expiredCases, unconfirmedSucceededPayments, recentCases, cronRuns,
    ] = await Promise.all([
      db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending"),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "pending").lte("expires_at", now),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "confirmed"),
      db.from("payments").select("id", { count: "exact", head: true }).eq("status", "succeeded"),
      db.from("payment_reconciliation_cases").select("id", { count: "exact", head: true }).eq("status", "open"),
      db.from("bookings").select("id", { count: "exact", head: true }).eq("status", "expired"),
      db.from("payments").select("id,bookings!inner(status)", { count: "exact", head: true }).eq("status", "succeeded").neq("bookings.status", "confirmed"),
      db.from("payment_reconciliation_cases").select("id,reason,status,created_at,provider_payment_id,bookings(booking_reference,status),payments(amount_paise,currency)")
        .order("created_at", { ascending: false }).limit(5),
      db.from("cron_job_runs").select("id,job_name,status,started_at,finished_at,released_seats,error_code")
        .eq("job_name", "release-expired-booking-holds").order("started_at", { ascending: false }).limit(8),
    ]);
    const errors = [pending, expiredPending, confirmed, succeededPayments, openCases, expiredCases, unconfirmedSucceededPayments, recentCases, cronRuns].filter(x => x.error);
    if (errors.length) {
      console.error("Operations monitoring query failed", errors.map(x => x.error?.code));
      return json({ ok: false, error: "monitoring_unavailable" }, 503);
    }
    return json({
      ok: true,
      generatedAt: now,
      metrics: {
        pendingBookings: pending.count ?? 0,
        pendingBookingsPastExpiry: expiredPending.count ?? 0,
        confirmedBookings: confirmed.count ?? 0,
        succeededPayments: succeededPayments.count ?? 0,
        openReconciliationCases: openCases.count ?? 0,
        expiredBookings: expiredCases.count ?? 0,
        succeededPaymentsWithoutConfirmedBooking: unconfirmedSucceededPayments.count ?? 0,
      },
      recentCases: recentCases.data ?? [],
      cronRuns: cronRuns.data ?? [],
    });
  } catch {
    return json({ ok: false, error: "server_not_configured" }, 503);
  }
}
