import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createStaffSession, setStaffCookie } from "../../../../lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, {
  status, headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" },
});

function safeEqual(a: string, b: string) {
  const aa = createHash("sha256").update(a).digest();
  const bb = createHash("sha256").update(b).digest();
  return timingSafeEqual(aa, bb) && a.length === b.length;
}

export async function POST(request: NextRequest) {
  const usernameExpected = process.env.HEPRABUS_STAFF_USERNAME;
  const passwordExpected = process.env.HEPRABUS_STAFF_PASSWORD;
  const secret = process.env.HEPRABUS_STAFF_SESSION_SECRET;
  if (!usernameExpected || !passwordExpected || !secret || secret.length < 32) {
    return json({ ok: false, error: "staff_auth_not_configured" }, 503);
  }
  let body: unknown;
  try { body = await request.json(); } catch { return json({ ok: false, error: "invalid_json" }, 400); }
  const username = body && typeof body === "object" && "username" in body && typeof body.username === "string" ? body.username.trim() : "";
  const password = body && typeof body === "object" && "password" in body && typeof body.password === "string" ? body.password : "";
  if (username.length > 120 || password.length > 256 || !safeEqual(username, usernameExpected) || !safeEqual(password, passwordExpected)) {
    return json({ ok: false, error: "invalid_credentials" }, 401);
  }
  const session = createStaffSession(secret, username);
  const response = json({ ok: true, username, expiresInSeconds: session.maxAge });
  setStaffCookie(response, session.value, session.maxAge);
  return response;
}
