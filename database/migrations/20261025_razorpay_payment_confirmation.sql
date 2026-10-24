-- Atomically reconcile a Razorpay captured payment with a pending seat hold.
-- A captured payment arriving after the hold expires is recorded as captured but is not auto-confirmed;
-- it must be reconciled/refunded manually because automated refunds are not configured.

CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_reference TEXT,
  p_provider_order_id TEXT,
  p_provider_payment_id TEXT,
  p_amount_paise INTEGER,
  p_currency TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_seats INTEGER := 0;
BEGIN
  IF p_booking_reference !~ '^HB-[A-F0-9]{12}$'
     OR coalesce(p_provider_order_id, '') = ''
     OR coalesce(p_provider_payment_id, '') = ''
     OR p_amount_paise IS NULL OR p_amount_paise < 0
     OR upper(coalesce(p_currency, '')) <> 'INR' THEN
    RAISE EXCEPTION 'Invalid payment confirmation' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE provider = 'razorpay'
    AND provider_order_id = p_provider_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE id = v_payment.booking_id
    AND booking_reference = upper(p_booking_reference)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking does not match payment order' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.amount_paise <> p_amount_paise
     OR upper(v_payment.currency) <> upper(p_currency)
     OR v_booking.total_paise <> p_amount_paise
     OR upper(v_booking.currency) <> upper(p_currency) THEN
    RAISE EXCEPTION 'Payment amount or currency mismatch' USING ERRCODE = '22023';
  END IF;

  IF v_payment.status = 'succeeded' THEN
    IF v_payment.provider_payment_id = p_provider_payment_id AND v_booking.status = 'confirmed' THEN
      RETURN jsonb_build_object('confirmed', true, 'status', 'confirmed', 'idempotent', true);
    END IF;
    RAISE EXCEPTION 'Conflicting duplicate payment event' USING ERRCODE = '23505';
  END IF;

  UPDATE public.payments
  SET status = 'succeeded',
      provider_payment_id = p_provider_payment_id,
      updated_at = now()
  WHERE id = v_payment.id;

  IF v_booking.status <> 'pending' OR v_booking.expires_at IS NULL OR v_booking.expires_at <= now() THEN
    RETURN jsonb_build_object(
      'confirmed', false,
      'status', v_booking.status,
      'reason', 'payment_captured_after_hold_expired',
      'manual_reconciliation_required', true
    );
  END IF;

  SELECT count(*) INTO v_seats
  FROM public.trip_seats
  WHERE held_by_booking_id = v_booking.id
    AND status = 'held'
    AND held_until > now();

  IF v_seats = 0 OR v_seats <> (
    SELECT count(*) FROM public.booking_passengers WHERE booking_id = v_booking.id
  ) THEN
    RETURN jsonb_build_object(
      'confirmed', false,
      'status', v_booking.status,
      'reason', 'seat_hold_inconsistent',
      'manual_reconciliation_required', true
    );
  END IF;

  UPDATE public.trip_seats
  SET status = 'booked', held_until = NULL, held_by_booking_id = NULL, updated_at = now()
  WHERE held_by_booking_id = v_booking.id AND status = 'held' AND held_until > now();

  UPDATE public.bookings
  SET status = 'confirmed', confirmed_at = now(), expires_at = NULL, updated_at = now()
  WHERE id = v_booking.id AND status = 'pending';

  RETURN jsonb_build_object('confirmed', true, 'status', 'confirmed', 'idempotent', false);
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_booking_payment(TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_booking_payment(TEXT, TEXT, TEXT, INTEGER, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(TEXT, TEXT, TEXT, INTEGER, TEXT) TO service_role;

COMMENT ON FUNCTION public.confirm_booking_payment(TEXT, TEXT, TEXT, INTEGER, TEXT)
IS 'Validates amount and order, records verified captured payment, and atomically confirms a pending seat hold. Late captured payments require manual reconciliation.';