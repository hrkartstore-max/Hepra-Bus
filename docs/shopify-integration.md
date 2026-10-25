# HEPRA BUS — Shopify-led architecture

## Goal

Use Shopify as the primary customer storefront and checkout experience while retaining the existing Next.js/Supabase service for live trip inventory, seat holds, passenger data, ticket issuance, and operator operations.

**Important:** this repository is not yet a connected Shopify store. No live Shopify checkout or payment configuration is enabled by this document. Do not accept real bookings until the end-to-end flow is implemented and tested.

## India payment-provider note

Shopify Payments is not generally available to merchants based in India. Create the store with India as its actual business location, then choose a payment provider displayed in that store's Settings → Payments. Availability depends on merchant eligibility, plan, and provider onboarding. Do not hard-code a provider or assume a gateway is enabled. Official guidance: https://help.shopify.com/en/manual/payments/third-party-providers/payment-gateway-availability

## Recommended architecture

- **Shopify Online Store:** brand, marketing pages, route landing pages, customer account and supported checkout.
- **HEPRA BUS Next.js service:** trip search, current fare quote, seat map, atomic seat holds, booking reference, passenger records, cancellation rules, ticket QR/verification.
- **Shopify custom app / server-side integration:** securely creates a payable Shopify order/checkout for a confirmed temporary hold and correlates Shopify order/payment state with the HEPRA booking.
- **Supabase:** remains the authoritative source for bus inventory and seat allocation. Shopify product inventory must not be treated as bus-seat inventory.

## Critical booking and payment flow

1. Customer searches available trips through the HEPRA BUS API.
2. Customer selects seats and boarding/dropping points.
3. HEPRA BUS server validates fare and creates an atomic, expiring seat hold.
4. A trusted server-side Shopify integration creates a checkout/order using the quoted amount and stores a non-sensitive HEPRA booking reference in metadata. Do not trust a fare, variant price, or booking reference supplied by the browser without server validation.
5. Customer pays using a payment provider actually activated in Shopify.
6. A Shopify webhook with verified HMAC is the source of the order/payment event. The webhook handler must be idempotent and must not confirm a ticket based on the browser return URL alone.
7. On verified paid order, HEPRA BUS confirms the booking only if the held seats are still valid. If payment arrives after the hold expires or seats cannot be confirmed, create a reconciliation case for manual handling/refund; never silently issue an overlapping ticket.
8. On cancellation/refund, update the HEPRA booking and release seats only according to the operator's cancellation policy and verified payment/refund state.

## Why a custom integration is required

A bus ticket is a time-bound service with a changing fare and a unique seat allocation. A normal Shopify product/variant has a configured product price and does not provide atomic bus-seat locking. Do not create a generic fixed-price bus-ticket variant and trust checkout line-item prices. Implement dynamic pricing and seat-hold coordination in a trusted Shopify custom app or supported server-side order/checkout integration before production.

## Implementation sequence

### Phase 1 — Store foundation
1. Create a Shopify store and enter the real business location, legal business details, currency (INR), policies, customer support details and domain.
2. Select a Shopify Online Store 2.0 theme and brand it as HEPRA BUS.
3. Create marketing/landing pages (Home, Search Buses, Manage Booking, Help, Terms, Privacy, Cancellation/Refund).
4. In Settings → Payments, activate an India-available provider shown in the store admin and complete its KYC/onboarding. Run test transactions before launch.

### Phase 2 — Custom integration
1. Create a Shopify custom app with least-privilege scopes for the selected order/checkout integration and webhooks.
2. Add server-only credentials to deployment secrets; never commit tokens or prefix admin secrets with NEXT_PUBLIC_.
3. Implement a server-side trip search adapter and a validated booking/seat-hold endpoint.
4. Implement the supported Shopify checkout/order creation flow with server-calculated amount, booking reference metadata, idempotency, expiry, and order-to-booking mapping.
5. Implement verified webhooks for paid, cancelled, and refunded events; persist webhook event IDs and make handlers idempotent.
6. Add reconciliation for late payment, duplicate webhooks, checkout abandonment, hold expiry, refund failures, and mismatched totals.
7. Test two customers attempting the same seat, payment success/failure, late payment, duplicate webhook, browser close/return, cancellation, and refund.

### Phase 3 — Go-live gate
- No real payment until provider onboarding, signed webhook verification, seat-hold race tests, privacy/security review, cancellation/refund testing, and production monitoring pass.
- Keep the current HEPRA BUS booking UI and APIs available during development; do not remove working backend functionality until the Shopify path is verified.
- Do not collect sensitive passenger data in Shopify line-item attributes or storefront URLs. Store only a random booking reference in checkout metadata and keep passenger records in the protected HEPRA backend.