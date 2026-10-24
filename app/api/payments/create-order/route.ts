import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "../../../../lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store, max-age=0" } });

const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(request: NextRequest) {
  const ip = (request.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const now = Date.now();
  const record = attempts.get(ip);
  if (!record || record.resetAt <= now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    if (attempts.size > 2_000) for (const [key, value] of attempts) if (value.resetAt <= now) attempts.delete(key);
    return false;
  }
  record.count += 1;
  return record.count > 5;
}

export async function POST(request: NextRequest) {
  if (rateLimited(request)) return json({ ok: false, error: "rate_limited" }, 429);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ ok: false, error: "invalid_request" }, 400);

  const input = body as Record<string, unknown>;
  const reference = typeof input.reference === "string" ? input.reference.trim().toUpperCase() : "";
  const phone = typeof input.phone === "string" ? input.phone.replace(/\D/g, "") : "";
  if (!/^HB-[A-F0-9]{12}$/.test(reference)) return json({ ok: false, error: "invalid_reference" }, 400);
  if (!/^[6-9][0-9]{9}$/.test(phone)) return json({ ok: false, error: "invalid_phone" }, 400);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return json({ ok: false, error: "payment_not_configured", message: "Payment provider credentials are not configured on the server." }, 503);

  try {
    const supabase = getSupabaseAdmin();
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select("id,booking_reference,contact_phone,status,currency,total_paise,expires_at")
      .eq("booking_reference", reference)
      .eq("contact_phone", phone)
      .maybeSingle();

    if (bookingError) return json({ ok: false, error: "booking_lookup_unavailable" }, 503);
    if (!booking) return json({ ok: false, error: "booking_not_found" }, 404);
    if (booking.status !== "pending" || !booking.expires_at || new Date(booking.expires_at).getTime() <= Date.now()) {
      return json({ ok: false, error: "hold_expired", message: "This seat hold is no longer payable. Search and select seats again." }, 409);
    }
    if (booking.currency.trim().toUpperCase() !== "INR" || !Number.isSafeInteger(booking.total_paise) || booking.total_paise < 100) {
      return json({ ok: false, error: "invalid_payment_amount" }, 400);
    }

    // Reuse an existing order for this booking when one is already pending.
    const { data: existing, error: existingError } = await supabase
      .from("payments")
      .select("provider_order_id,amount_paise,currency,status")
      .eq("booking_id", booking.id)
      .eq("provider", "razorpay")
      .eq("status", "created")
      .not("provider_order_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) return json({ ok: false, error: "payment_lookup_unavailable" }, 503);
    if (existing?.provider_order_id && existing.amount_paise === booking.total_paise && existing.currency.trim().toUpperCase() === "INR") {
      return json({ ok: true, keyId, orderId: existing.provider_order_id, amount: booking.total_paise, currency: "INR", bookingReference: reference, provider: "razorpay" });
    }

    const receipt = `hb_${createHash("sha256").update(booking.id).digest("hex").slice(0, 32)}`;
    const providerResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: booking.total_paise,
        currency: "INR",
        receipt,
        notes: { booking_reference: reference, application: "HepraBus" },
      }),
      cache: "no-store",
    });
    const order = await providerResponse.json();
    if (!providerResponse.ok || typeof order.id !== "string") {
      console.error("Razorpay order creation failed", { status: providerResponse.status, code: order?.error?.code });
      return json({ ok: false, error: "payment_order_failed", message: "Could not create a payment order. Please retry." }, 502);
    }

    const idempotencyKey = `heprabus:${booking.id}:${new Date(booking.expires_at).getTime()}`;
    const { error: insertError } = await supabase.from("payments").insert({
      booking_id: booking.id,
      provider: "razorpay",
      provider_order_id: order.id,
      status: "created",
      amount_paise: booking.total_paise,
      currency: "INR",
      idempotency_key: idempotencyKey,
      provider_payload: { order_status: order.status, receipt: order.receipt },
    });
    if (insertError) {
      console.error("Payment order persistence failed", { code: insertError.code });
      return json({ ok: false, error: "payment_persistence_failed", message: "Payment order could not be safely saved. Do not pay yet; contact support." }, 503);
    }

    return json({ ok: true, keyId, orderId: order.id, amount: booking.total_paise, currency: "INR", bookingReference: reference, provider: "razorpay" }, 201);
  } catch {
    return json({ ok: false, error: "payment_service_unavailable" }, 503);
  }
}
