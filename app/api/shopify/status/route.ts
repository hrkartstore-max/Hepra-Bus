import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Reports Shopify integration configuration without exposing tokens or secrets.
 * This is a setup diagnostic only; it does not prove that checkout, payments,
 * webhooks, or a Shopify store are fully configured.
 */
export async function GET() {
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN?.trim() ?? "";
  const storefrontToken = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN?.trim() ?? "";
  const adminToken = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim() ?? "";
  const apiSecret = process.env.SHOPIFY_API_SECRET?.trim() ?? "";

  const domainLooksValid =
    /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(storeDomain);

  const storefrontConfigured = domainLooksValid && storefrontToken.length > 0;
  const serverAppConfigured =
    domainLooksValid && adminToken.length > 0 && apiSecret.length > 0;

  return NextResponse.json(
    {
      ok: true,
      integration: "shopify",
      storeDomainConfigured: domainLooksValid,
      storefrontCredentialsConfigured: storefrontConfigured,
      serverAppCredentialsConfigured: serverAppConfigured,
      checkoutReady: false,
      paymentProviderConfigured: false,
      note:
        "Configuration presence is not a live checkout test. Shopify custom-app checkout, verified webhooks, payment-provider activation, and seat-hold reconciliation must be implemented and tested before production.",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        Pragma: "no-cache",
      },
    },
  );
}
