-- Allow customers to release their own unexpired pending seat hold using reference + phone.
-- Payment/refund flows are not implemented; only pending holds can be cancelled.

CREATE OR REPLACE FUNCTION public.cancel_booking_hold(
  p_booking_reference TEXT,
  p_contact_phone TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_released INTEGER := 0;
BEGIN
  IF p_booking_reference !~ '^HB-[A-F0-9]{12}$'
     OR length(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g')) <> 10 THEN
    RAISE EXCEPTION 'Invalid booking lookup' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_booking
  FROM public.bookings
  WHERE booking_reference = upper(p_booking_reference)
    AND contact_phone = regexp_replace(p_contact_phone, '[^0-9]', '', 'g')
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_booking.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'cancelled', false,
      'status', v_booking.status,
      'message', 'Only pending temporary holds can be cancelled here.'
    );
  END IF;

  IF v_booking.expires_at IS NOT NULL AND v_booking.expires_at <= now() THEN
    UPDATE public.bookings
    SET status = 'expired', updated_at = now()
    WHERE id = v_booking.id;

    UPDATE public.trip_seats
    SET status = 'available', held_until = NULL, held_by_booking_id = NULL, updated_at = now()
    WHERE status = 'held' AND held_by_booking_id = v_booking.id;

    RETURN jsonb_build_object('cancelled', false, 'status', 'expired', 'message', 'This hold has already expired.');
  END IF;

  UPDATE public.bookings
  SET status = 'cancelled', cancelled_at = now(), updated_at = now()
  WHERE id = v_booking.id;

  UPDATE public.trip_seats
  SET status = 'available', held_until = NULL, held_by_booking_id = NULL, updated_at = now()
  WHERE status = 'held' AND held_by_booking_id = v_booking.id;

  GET DIAGNOSTICS v_released = ROW_COUNT;

  RETURN jsonb_build_object(
    'cancelled', true,
    'status', 'cancelled',
    'released_seats', v_released,
    'message', 'Temporary seat hold cancelled and held seats released.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_booking_hold(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_booking_hold(TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_booking_hold(TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.cancel_booking_hold(TEXT, TEXT)
IS 'Cancels a pending temporary seat hold only after matching booking reference and contact phone; no payment/refund processing.';
