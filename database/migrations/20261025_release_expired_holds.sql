-- Release expired pending bookings and their seats safely.
-- Invoke from a trusted server-side scheduled job only.

CREATE OR REPLACE FUNCTION public.release_expired_booking_holds(p_limit INTEGER DEFAULT 500)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking_ids UUID[];
  v_released INTEGER := 0;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 5000 THEN
    RAISE EXCEPTION 'Limit must be between 1 and 5000' USING ERRCODE = '22023';
  END IF;

  WITH expired AS (
    SELECT b.id
    FROM public.bookings b
    WHERE b.status = 'pending'
      AND b.expires_at IS NOT NULL
      AND b.expires_at <= now()
    ORDER BY b.expires_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  SELECT array_agg(id) INTO v_booking_ids FROM expired;

  IF v_booking_ids IS NULL OR cardinality(v_booking_ids) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.bookings
  SET status = 'expired', updated_at = now()
  WHERE id = ANY(v_booking_ids)
    AND status = 'pending'
    AND expires_at <= now();

  UPDATE public.trip_seats
  SET status = 'available',
      held_until = NULL,
      held_by_booking_id = NULL,
      updated_at = now()
  WHERE status = 'held'
    AND held_by_booking_id = ANY(v_booking_ids)
    AND held_until <= now();

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

REVOKE ALL ON FUNCTION public.release_expired_booking_holds(INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_expired_booking_holds(INTEGER) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_expired_booking_holds(INTEGER) TO service_role;

COMMENT ON FUNCTION public.release_expired_booking_holds(INTEGER)
IS 'Expires overdue pending bookings and releases their held seats. Trusted server-side scheduler only.';
