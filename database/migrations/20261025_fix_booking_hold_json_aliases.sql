-- Correct JSONB set-returning function aliases in the booking-hold RPC.
CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_trip_id UUID,
  p_contact_name TEXT,
  p_contact_phone TEXT,
  p_contact_email TEXT,
  p_passengers JSONB,
  p_hold_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_trip public.trips%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_passenger_count INTEGER;
  v_unique_seat_count INTEGER;
  v_total BIGINT;
  v_item JSONB;
  v_seat public.trip_seats%ROWTYPE;
BEGIN
  IF p_trip_id IS NULL
     OR length(trim(coalesce(p_contact_name, ''))) NOT BETWEEN 2 AND 120
     OR length(regexp_replace(coalesce(p_contact_phone, ''), '[^0-9]', '', 'g')) NOT BETWEEN 10 AND 15
     OR jsonb_typeof(p_passengers) <> 'array'
     OR p_hold_minutes NOT BETWEEN 5 AND 15 THEN
    RAISE EXCEPTION 'Invalid booking hold request' USING ERRCODE = '22023';
  END IF;

  v_passenger_count := jsonb_array_length(p_passengers);
  IF v_passenger_count < 1 OR v_passenger_count > 6 THEN
    RAISE EXCEPTION 'Select between 1 and 6 seats' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT trim(p.value->>'seat_label')) INTO v_unique_seat_count
  FROM jsonb_array_elements(p_passengers) AS p(value)
  WHERE jsonb_typeof(p.value) = 'object'
    AND length(trim(coalesce(p.value->>'seat_label', ''))) BETWEEN 1 AND 20
    AND length(trim(coalesce(p.value->>'passenger_name', ''))) BETWEEN 2 AND 120;

  IF v_unique_seat_count <> v_passenger_count THEN
    RAISE EXCEPTION 'Passenger details are invalid or duplicate seats were selected' USING ERRCODE = '22023';
  END IF;

  SELECT t.* INTO v_trip
  FROM public.trips t
  JOIN public.routes r ON r.id = t.route_id
  JOIN public.operators o ON o.id = r.operator_id
  WHERE t.id = p_trip_id
    AND t.sales_open = TRUE
    AND t.departure_at > now()
    AND r.active = TRUE
    AND o.active = TRUE
  FOR SHARE OF t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Trip is unavailable for booking' USING ERRCODE = 'P0002';
  END IF;

  PERFORM s.id
  FROM public.trip_seats s
  JOIN jsonb_array_elements(p_passengers) AS p(value)
    ON s.seat_label = trim(p.value->>'seat_label')
  WHERE s.trip_id = p_trip_id
  ORDER BY s.seat_label
  FOR UPDATE OF s;

  IF (SELECT count(*)
      FROM public.trip_seats s
      JOIN jsonb_array_elements(p_passengers) AS p(value)
        ON s.seat_label = trim(p.value->>'seat_label')
      WHERE s.trip_id = p_trip_id) <> v_passenger_count THEN
    RAISE EXCEPTION 'One or more selected seats do not exist' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.trip_seats s
    JOIN jsonb_array_elements(p_passengers) AS p(value)
      ON s.seat_label = trim(p.value->>'seat_label')
    WHERE s.trip_id = p_trip_id
      AND NOT (
        s.status = 'available'
        OR (s.status = 'held' AND s.held_until IS NOT NULL AND s.held_until <= now())
      )
  ) THEN
    RAISE EXCEPTION 'One or more selected seats are no longer available' USING ERRCODE = '23505';
  END IF;

  v_total := v_trip.base_fare_paise::BIGINT * v_passenger_count;
  IF v_total > 2147483647 THEN
    RAISE EXCEPTION 'Booking total is out of range' USING ERRCODE = '22003';
  END IF;

  INSERT INTO public.bookings (
    trip_id, contact_name, contact_phone, contact_email, status,
    currency, subtotal_paise, taxes_paise, total_paise, expires_at
  ) VALUES (
    p_trip_id, trim(p_contact_name),
    regexp_replace(p_contact_phone, '[^0-9]', '', 'g'),
    NULLIF(trim(coalesce(p_contact_email, '')), ''),
    'pending', v_trip.currency,
    v_total::INTEGER, 0, v_total::INTEGER, now() + make_interval(mins => p_hold_minutes)
  ) RETURNING * INTO v_booking;

  FOR v_item IN SELECT p.value FROM jsonb_array_elements(p_passengers) AS p(value)
  LOOP
    SELECT s.* INTO v_seat
    FROM public.trip_seats s
    WHERE s.trip_id = p_trip_id
      AND s.seat_label = trim(v_item->>'seat_label')
    FOR UPDATE;

    UPDATE public.trip_seats
    SET status = 'held',
        held_until = v_booking.expires_at,
        held_by_booking_id = v_booking.id,
        updated_at = now()
    WHERE id = v_seat.id;

    INSERT INTO public.booking_passengers (
      booking_id, trip_seat_id, passenger_name, fare_paise
    ) VALUES (
      v_booking.id, v_seat.id, trim(v_item->>'passenger_name'), v_trip.base_fare_paise
    );
  END LOOP;

  RETURN jsonb_build_object(
    'booking_id', v_booking.id,
    'booking_reference', v_booking.booking_reference,
    'status', v_booking.status,
    'expires_at', v_booking.expires_at,
    'currency', v_booking.currency,
    'total_paise', v_booking.total_paise,
    'payment_integrated', false
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER) TO service_role;
