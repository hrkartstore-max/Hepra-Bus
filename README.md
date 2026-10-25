# HepraBus

Responsive Next.js 15 bus booking website starter.

## Supabase setup (server-side only)
1. Create or choose a dedicated Supabase project for HepraBus.
2. In Supabase Project Settings -> API, configure the project URL and server-only key as `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in local `.env.local` and Vercel Environment Variables.
3. Never expose the service-role key with a `NEXT_PUBLIC_` prefix, commit it, or share it in chat.
4. Review `database/schema.sql` and apply it only to the dedicated HepraBus database. It creates starter booking tables; it does not make the current demo UI live.
5. Keep server-only database access on the server. Add transactional seat allocation, authentication, payment webhook verification, and live API wiring before accepting real bookings.

## Run locally
- Node.js 20+
- `npm install`
- `npm run dev`

## Current status
The homepage, responsive search form, popular routes and offer section are a working UI prototype. Search currently displays demo status only. Live operator inventory, seat locking, authenticated bookings, payment processing, e-ticket issuance, admin/operator backend, cancellations and refunds require server-side services and provider integrations. Do not use this prototype to accept real payments.

## Supabase backend foundation

The dedicated Supabase project is `bvxemzzzyfejmiljyjwf` in Mumbai (`ap-south-1`). The schema at `database/schema.sql` has been applied and verified. The seven tables are `operators`, `routes`, `trips`, `trip_seats`, `bookings`, `booking_passengers`, and `payments`.

### Security status
- Row Level Security is enabled on all seven public tables.
- No public RLS policies have been created. This intentionally blocks normal client-role access until policies are reviewed.
- The migration is recorded in `database/migrations/20261024_enable_rls.sql`.
- `lib/supabase-admin.ts` creates a server-only Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The service-role key bypasses RLS and must never be exposed to client components or committed to Git.
- `GET /api/db/status` performs a minimal server-side connectivity check and does not return database rows or secrets. It also explicitly reports that booking flows are not live.

### Environment configuration
Copy `.env.example` to `.env.local` and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong `AUTH_SECRET`. Add the same values in Vercel Project Settings -> Environment Variables. Never prefix the service-role key with `NEXT_PUBLIC_` and never share it in chat.

**Production status:** The database schema and server-side client foundation exist, but the current UI still uses demo booking data. Real bookings, transactional seat locking/expiry, authenticated customer and admin access, payment webhook verification, rate limiting, and ticket issuance are not implemented or verified. Do not accept real passenger information or payments yet.


### API validation foundation

- `POST /api/bookings/validate` validates a proposed booking payload.
- `POST /api/bookings/validate?mode=lookup` validates a booking-reference lookup payload.
- The endpoint returns validation errors for malformed JSON or invalid fields and disables response caching.
- **These endpoints do not create or retrieve bookings.** Database transactions, seat locking, authenticated access, rate limiting and privacy-safe logging must be implemented before production use.

## Shopify-led storefront integration (in progress)

A new Shopify storefront preview was requested for HEPRA BUS. Preview generation is pending; it is not yet a created or claimed Shopify store. Claiming a generated preview creates a new store and does not connect it automatically to this repository.

- Architecture and phased setup: `docs/shopify-integration.md`
- Safe readiness diagnostic: `GET /api/shopify/status`
- Shopify environment placeholders: `.env.example`

The diagnostic only reports whether configuration values are present. It does not verify Shopify API access, checkout, gateway activation, webhook signatures, or booking confirmation.

### Next implementation steps

1. Claim the generated preview after Shopify finishes generating it, then complete the new store setup using the actual business details.
2. In Shopify Admin, check Settings → Payments for providers available to the store's India-based business and complete provider onboarding.
3. Create a Shopify custom app and configure least-privilege API scopes plus the required webhooks.
4. Implement server-side trip search and booking hold integration; keep Supabase as the source of truth for seat inventory.
5. Implement the supported Shopify checkout/order workflow with server-calculated fares, idempotent order-to-booking mapping, verified webhook HMAC, and late-payment reconciliation.
6. Test checkout and booking lifecycle end-to-end before enabling real customer payments.

**Production warning:** HEPRA BUS is not yet integrated with a live Shopify store. Do not accept real payments or passenger bookings through Shopify until the integration and concurrency/payment tests are complete.

