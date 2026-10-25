ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS boarding_point TEXT,
  ADD COLUMN IF NOT EXISTS dropping_point TEXT;

CREATE OR REPLACE FUNCTION public.create_booking_hold(
  p_trip_id UUID,
  p_contact_name TEXT,
  p_contact_phone TEXT,
  p_contact_email TEXT,
  p_passengers JSONB,
  p_hold_minutes INTEGER,
  p_boarding_point TEXT,
  p_dropping_point TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result JSONB;
  v_booking_id UUID;
  v_route RECORD;
  v_boarding TEXT := NULLIF(trim(coalesce(p_boarding_point, '')), '');
  v_dropping TEXT := NULLIF(trim(coalesce(p_dropping_point, '')), '');
BEGIN
  IF v_boarding IS NULL OR v_dropping IS NULL OR length(v_boarding) > 160 OR length(v_dropping) > 160 THEN
    RAISE EXCEPTION 'Choose valid boarding and dropping points' USING ERRCODE = '22023';
  END IF;
  SELECT r.origin_city, r.destination_city, r.origin_stop, r.destination_stop
    INTO v_route
  FROM public.trips t JOIN public.routes r ON r.id = t.route_id
  WHERE t.id = p_trip_id AND t.sales_open = TRUE AND t.departure_at > now() AND r.active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Trip is unavailable for booking' USING ERRCODE = 'P0002'; END IF;
  IF v_boarding NOT IN (v_route.origin_city, coalesce(v_route.origin_stop, v_route.origin_city))
     OR v_dropping NOT IN (v_route.destination_city, coalesce(v_route.destination_stop, v_route.destination_city)) THEN
    RAISE EXCEPTION 'Selected boarding or dropping point is not valid for this route' USING ERRCODE = '22023';
  END IF;
  v_result := public.create_booking_hold(p_trip_id, p_contact_name, p_contact_phone, p_contact_email, p_passengers, p_hold_minutes);
  v_booking_id := (v_result->>'booking_id')::UUID;
  UPDATE public.bookings SET boarding_point = v_boarding, dropping_point = v_dropping, updated_at = now() WHERE id = v_booking_id;
  RETURN v_result || jsonb_build_object('boarding_point', v_boarding, 'dropping_point', v_dropping);
END;
$$;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, TEXT) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_booking_hold(UUID, TEXT, TEXT, TEXT, JSONB, INTEGER, TEXT, TEXT) TO service_role;
COMMENT ON COLUMN public.bookings.boarding_point IS 'Customer-selected boarding point validated against the trip route.';
COMMENT ON COLUMN public.bookings.dropping_point IS 'Customer-selected dropping point validated against the trip route.';
