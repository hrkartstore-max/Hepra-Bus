# HepraBus

Responsive Next.js 15 bus booking website starter.

## Run locally
- Node.js 20+
- `npm install`
- `npm run dev`

## Current status
The homepage, responsive search form, popular routes and offer section are a working UI prototype. Search currently displays demo status only. Live operator inventory, seat locking, authenticated bookings, payment processing, e-ticket issuance, admin/operator backend, cancellations and refunds require server-side services and provider integrations. Do not use this prototype to accept real payments.

## Backend foundation (database not connected yet)

A starter PostgreSQL schema is available at `database/schema.sql`. It defines operators, routes, scheduled trips, trip seats, bookings, passenger records and payment records, with basic checks and indexes. Amounts are stored as integer paise to avoid floating-point currency calculations.

### Setup outline
1. Create a dedicated PostgreSQL database with your chosen provider.
2. Review `database/schema.sql` with your database administrator, then apply it to that database.
3. Copy `.env.example` to `.env.local` for local development and set `DATABASE_URL` and a strong server-side `AUTH_SECRET`. Do not commit actual credentials.
4. Implement a server-side database client and authenticated API routes before connecting any UI to the schema.
5. For production, add transactional seat holds, booking expiry, payment-provider signature verification, idempotency, role-based admin access, audit logs, privacy/retention rules, and cancellation/refund handling.

**Important:** Adding the SQL schema does not connect the current website to PostgreSQL. The present seat selection, booking confirmation, My Trips lookup and admin demo use browser-local demo data. No real bookings, payment processing, ticket issuance, or protected admin operations are available yet. Do not enter real passenger information into the demo.
