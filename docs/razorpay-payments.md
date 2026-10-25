# HepraBus Razorpay payment setup

This implementation creates Razorpay orders on the server and confirms bookings only from a verified Razorpay webhook. It is not ready for live money until credentials, webhook configuration, tests, and deployment are completed.

## Required server environment variables

Configure these in local `.env.local` and the Vercel project environment settings (server-side only):

- `RAZORPAY_KEY_ID` — use a Razorpay **Test Mode** key first.
- `RAZORPAY_KEY_SECRET` — secret paired with the key ID. Never expose it to the browser.
- `RAZORPAY_WEBHOOK_SECRET` — a separate secret you configure in the Razorpay webhook settings.
- Existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` remain required.

Do not commit real values or prefix secrets with `NEXT_PUBLIC_`.

## Razorpay webhook

Configure the webhook URL to:

`https://YOUR_DEPLOYED_DOMAIN/api/payments/razorpay-webhook`

Subscribe to the `payment.captured` event. Copy the webhook signing secret into `RAZORPAY_WEBHOOK_SECRET`. The webhook reads the raw request body and validates `x-razorpay-signature` before processing the event.

## Flow

1. Customer creates a temporary seat hold.
2. `POST /api/payments/create-order` accepts the booking reference and contact phone, checks the matching pending hold and expiry, and creates/reuses a Razorpay order for the database-calculated amount.
3. Razorpay Checkout opens in the browser.
4. The browser callback is informational only; it does not confirm a booking.
5. The verified `payment.captured` webhook checks order amount/currency and calls `confirm_booking_payment`.
6. The database function idempotently records a captured payment and changes held seats to booked only while the matching hold remains valid.

## Important reconciliation rule

If payment is captured after the seat hold has expired, or the held-seat inventory is inconsistent, the payment is recorded as succeeded but the booking is not auto-confirmed. The webhook writes an idempotent case to the server-only payment_reconciliation_cases table. Duplicate captured-event retries are checked against persisted payment and booking state; a matching already-recorded payment is acknowledged without pretending the booking was confirmed.\n\nStaff can review cases at /admin/reconciliation after signing in at /admin/verification. The queue records the reason, booking reference, payment ID, amount and status. Marking a case resolved or refunded is an operational note only: it does not issue a refund or confirm the booking. Verify the payment in Razorpay and follow the operator's refund/rebooking procedure. Refund automation is not implemented.

## Before production

- Test success, failure, dismissal, duplicate webhook, wrong signature, amount mismatch, and expired-hold scenarios in Razorpay Test Mode.
- Configure a shared rate limiter and stronger booking ownership/OTP protection; the current public endpoints use per-instance rate limiting.
- Verify Vercel environment variables and deployment logs.
- Implement customer support, refund/cancellation rules, privacy/retention policies, and ticket generation.
- Do not describe a booking as ticketed until the database status is confirmed and a ticketing workflow exists.
