-- HepraBus security hardening
-- Applied to Supabase project bvxemzzzyfejmiljyjwf on 2026-10-24.
-- RLS is enabled with no client-facing policies by design. Keep all current
-- data access server-side. Do not add public policies without an explicit review.

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_passengers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
