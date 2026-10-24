# HepraBus Admin Inventory API

This is a server-side, token-protected inventory bootstrap API. It is intended for a trusted administrator or a private admin tool, not direct public browser calls.

## Configure the secret first

Set `HEPRABUS_ADMIN_TOKEN` in the server environment (local `.env.local` and the Vercel project environment variables). Use a long random value, keep it secret, and never use a `NEXT_PUBLIC_` prefix. Do not commit real tokens. The route also requires the existing `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` server environment variables.

Requests must include the header `x-heprabus-admin-token: <your token>`. The API returns 401 when the token is missing or invalid.

## Create an operator

```bash
curl -X POST "$BASE_URL/api/admin/inventory" \
  -H "Content-Type: application/json" \
  -H "x-heprabus-admin-token: $HEPRABUS_ADMIN_TOKEN" \
  -d '{
    "action": "create_operator",
    "name": "Example Bus Operator",
    "supportEmail": "ops@example.com",
    "supportPhone": "+91 9000000000"
  }'
```

Save the returned `operator.id`.

## Create a route

```bash
curl -X POST "$BASE_URL/api/admin/inventory" \
  -H "Content-Type: application/json" \
  -H "x-heprabus-admin-token: $HEPRABUS_ADMIN_TOKEN" \
  -d '{
    "action": "create_route",
    "operatorId": "OPERATOR_UUID_FROM_RESPONSE",
    "originCity": "Chennai",
    "destinationCity": "Bengaluru",
    "originStop": "Koyambedu",
    "destinationStop": "Majestic",
    "distanceKm": 350
  }'
```

Save the returned `route.id`.

## Create a trip and its seats

`departureAt` and `arrivalAt` must be ISO-8601 timestamps with an explicit timezone offset (for example, `2026-11-01T22:00:00+05:30`). Departure must be in the future. `fareRupees` is the fare per seat in rupees. Seat labels must be unique (up to 60), such as `A1`, `A2`, `B1`, `B2`.

```bash
curl -X POST "$BASE_URL/api/admin/inventory" \
  -H "Content-Type: application/json" \
  -H "x-heprabus-admin-token: $HEPRABUS_ADMIN_TOKEN" \
  -d '{
    "action": "create_trip",
    "routeId": "ROUTE_UUID_FROM_RESPONSE",
    "busLabel": "HB Chennai Express",
    "busType": "AC Sleeper",
    "departureAt": "2026-11-01T22:00:00+05:30",
    "arrivalAt": "2026-11-02T05:00:00+05:30",
    "fareRupees": 799,
    "seatLabels": ["A1", "A2", "B1", "B2", "C1", "C2"]
  }'
```

The endpoint creates the trip, then creates the specified seats. If seat creation fails, it attempts to delete the newly created trip. This is compensating cleanup, not a database transaction; inspect the returned error and database state if cleanup itself fails.

## Important limitations

- This endpoint creates inventory only; it does not process payments or issue tickets.
- There is no admin login UI, role-based user management, audit log, or token rotation UI yet.
- Keep the token out of client-side code, browser storage, URLs, and logs. Call this endpoint only from a trusted private tool.
- Protect production deployments with appropriate access controls and rate limiting before broad operational use.
- Trip search will only show trips matching the selected route/date. Avoid entering fake inventory on a production site.
