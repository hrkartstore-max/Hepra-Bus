import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

function validSignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let received: Buffer;
  try { received = Buffer.from(signature, "hex"); } catch { return false; }
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return json({ ok: false, error: "webhook_not_configured" }, 503);

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  if (!signature || !validSignature(rawBody, signature, webhookSecret)) {
    return json({ ok: false, error: "invalid_signature" }, 400);
  }

  let event: Record<string, any>;
  try { event = JSON.parse(rawBody) as Record<string, any>; } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (event.event !== "payment.captured") {
    // Other verified events are acknowledged, but do not confirm a booking.
    return json({ ok: true, ignored: true });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment || typeof payment.id !== "string" || typeof payment.order_id !== "string" ||
      !Number.isSafeInteger(payment.amount) || typeof payment.currency !== "string") {
    return json({ ok: false, error: "invalid_payment_event" }, 400);
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data: record, error: recordError } = await supabase
      .from("payments")
      .select("id,booking_id,provider_order_id,amount_paise,currency")
      .eq("provider", "razorpay")
      .eq("provider_order_id", payment.order_id)
      .maybeSingle();
    if (recordError) return json({ ok: false, error: "payment_lookup_unavailable" }, 503);
    if (!record) return json({ ok: false, error: "order_not_found" }, 404);
    if (record.amount_paise !== payment.amount || record.currency.trim().toUpperCase() !== payment.currency.toUpperCase()) {
      console.error("Razorpay webhook amount mismatch", { orderId: payment.order_id });
      return json({ ok: false, error: "payment_mismatch" }, 400);
    }

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("booking_reference")
      .eq("id", record.booking_id)
      .maybeSingle();
    if (bookingError || !booking) return json({ ok: false, error: "booking_lookup_unavailable" }, 503);

    const { data: result, error: confirmError } = await supabase.rpc("confirm_booking_payment", {
      p_booking_reference: booking.booking_reference,
      p_provider_order_id: payment.order_id,
      p_provider_payment_id: payment.id,
      p_amount_paise: payment.amount,
      p_currency: payment.currency,
    });
    if (confirmError) {
      // A duplicate captured event may arrive after the payment was recorded but the booking
      // could not be confirmed. Read back persisted state to acknowledge that retry safely.
      const { data: currentPayment, error: currentPaymentError } = await supabase
        .from("payments").select("id,status,provider_payment_id").eq("id", record.id).maybeSingle();
      const { data: currentBooking, error: currentBookingError } = await supabase
        .from("bookings").select("status").eq("id", record.booking_id).maybeSingle();
      if (!currentPaymentError && !currentBookingError && currentPayment?.status === "succeeded" &&
          currentPayment.provider_payment_id === payment.id && currentBooking && currentBooking.status !== "confirmed") {
        const reason = currentBooking.status === "expired" ? "payment_captured_after_hold_expired" : "duplicate_capture_conflict";
        const { error: caseError } = await supabase.from("payment_reconciliation_cases").upsert({
          booking_id: record.booking_id, payment_id: record.id, provider_payment_id: payment.id, reason,
          details: { bookingStatus: currentBooking.status, source: "duplicate_webhook_retry" },
          updated_at: new Date().toISOString(),
        }, { onConflict: "payment_id,reason", ignoreDuplicates: true });
        if (caseError) {
          console.error("Could not persist duplicate payment reconciliation case", { code: caseError.code, orderId: payment.order_id });
          return json({ ok: false, error: "payment_reconciliation_failed" }, 503);
        }
        console.warn("Duplicate captured payment acknowledged; booking still needs reconciliation", {
          bookingReference: booking.booking_reference, orderId: payment.order_id, reason,
        });
        return json({ ok: true, idempotent: true, manual_reconciliation_required: true, reason });
      }
      console.error("Razorpay payment reconciliation failed", { code: confirmError.code, orderId: payment.order_id });
      return json({ ok: false, error: "payment_reconciliation_failed" }, 503);
    }
    if (result?.manual_reconciliation_required) {
      const reason = result.reason === "payment_captured_after_hold_expired" || result.reason === "seat_hold_inconsistent"
        ? result.reason : "duplicate_capture_conflict";
      const { error: caseError } = await supabase.from("payment_reconciliation_cases").upsert({
        booking_id: record.booking_id, payment_id: record.id, provider_payment_id: payment.id, reason,
        details: { bookingStatus: result.status ?? null, source: "payment_captured_webhook" },
        updated_at: new Date().toISOString(),
      }, { onConflict: "payment_id,reason", ignoreDuplicates: true });
      if (caseError) {
        console.error("Could not persist payment reconciliation case", { code: caseError.code, orderId: payment.order_id });
        return json({ ok: false, error: "payment_reconciliation_failed" }, 503);
      }
      console.error("Captured payment needs manual reconciliation", { bookingReference: booking.booking_reference, reason });
    }
    return json({ ok: true, result });
  } catch {
    return json({ ok: false, error: "webhook_processing_failed" }, 503);
  }
}
