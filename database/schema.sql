-- HepraBus PostgreSQL starter schema
-- Apply only to a new, dedicated database after reviewing the schema.
-- This schema does not connect the current demo UI to a database by itself.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE booking_status AS ENUM (
  'pending', 'confirmed', 'cancelled', 'expired', 'failed'
);
CREATE TYPE payment_status AS ENUM (
  'created', 'pending', 'succeeded', 'failed', 'refunded', 'partially_refunded'
);
CREATE TYPE seat_status AS ENUM ('available', 'blocked', 'booked');

CREATE TABLE IF NOT EXISTS operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  support_email TEXT,
  support_phone TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES operators(id) ON DELETE RESTRICT,
  origin_city TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  origin_stop TEXT,
  destination_stop TEXT,
  distance_km NUMERIC(8,2) CHECK (distance_km IS NULL OR distance_km > 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (lower(origin_city) <> lower(destination_city))
);

CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES routes(id) ON DELETE RESTRICT,
  bus_label TEXT NOT NULL,
  bus_type TEXT NOT NULL DEFAULT 'AC Sleeper',
  departure_at TIMESTAMPTZ NOT NULL,
  arrival_at TIMESTAMPTZ NOT NULL,
  base_fare_paise INTEGER NOT NULL CHECK (base_fare_paise >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  sales_open BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (arrival_at > departure_at)
);

CREATE INDEX IF NOT EXISTS trips_route_departure_idx ON trips(route_id, departure_at) WHERE sales_open = TRUE;

CREATE TABLE IF NOT EXISTS trip_seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  seat_label TEXT NOT NULL,
  seat_type TEXT NOT NULL DEFAULT 'seater',
  status seat_status NOT NULL DEFAULT 'available',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trip_id, seat_label)
);

CREATE INDEX IF NOT EXISTS trip_seats_availability_idx ON trip_seats(trip_id, status);

CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_reference TEXT NOT NULL UNIQUE DEFAULT ('HB-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12))),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
  contact_name TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  contact_email TEXT,
  status booking_status NOT NULL DEFAULT 'pending',
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  subtotal_paise INTEGER NOT NULL CHECK (subtotal_paise >= 0),
  taxes_paise INTEGER NOT NULL DEFAULT 0 CHECK (taxes_paise >= 0),
  total_paise INTEGER NOT NULL CHECK (total_paise >= 0),
  expires_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (total_paise = subtotal_paise + taxes_paise)
);

CREATE INDEX IF NOT EXISTS bookings_trip_status_idx ON bookings(trip_id, status);
CREATE INDEX IF NOT EXISTS bookings_phone_created_idx ON bookings(contact_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS bookings_expiry_idx ON bookings(expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS booking_passengers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  trip_seat_id UUID NOT NULL REFERENCES trip_seats(id) ON DELETE RESTRICT,
  passenger_name TEXT NOT NULL,
  fare_paise INTEGER NOT NULL CHECK (fare_paise >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, trip_seat_id)
);

CREATE INDEX IF NOT EXISTS booking_passengers_booking_idx ON booking_passengers(booking_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_order_id TEXT UNIQUE,
  provider_payment_id TEXT UNIQUE,
  status payment_status NOT NULL DEFAULT 'created',
  amount_paise INTEGER NOT NULL CHECK (amount_paise >= 0),
  currency CHAR(3) NOT NULL DEFAULT 'INR',
  idempotency_key TEXT UNIQUE,
  provider_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments(booking_id, created_at DESC);

-- This schema intentionally contains no public RLS policies or application credentials.
-- Before production: configure database roles/permissions, authenticated admin access,
-- seat holds with expiry, transactional seat allocation, payment webhook verification,
-- audit logs, privacy retention and cancellation/refund workflows.
