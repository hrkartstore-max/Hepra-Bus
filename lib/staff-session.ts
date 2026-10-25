import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest, NextResponse } from "next/server";

export const STAFF_COOKIE = "heprabus_staff_session";
const MAX_AGE_SECONDS = 8 * 60 * 60;

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function createStaffSession(secret: string, username: string) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })).toString("base64url");
  return { value: payload + "." + sign(payload, secret), maxAge: MAX_AGE_SECONDS };
}

export function verifyStaffSession(request: NextRequest) {
  const secret = process.env.HEPRABUS_STAFF_SESSION_SECRET;
  if (!secret || secret.length < 32) return false;
  const token = request.cookies.get(STAFF_COOKIE)?.value ?? "";
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const expected = Buffer.from(sign(parts[0], secret));
  const supplied = Buffer.from(parts[1]);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")) as { sub?: unknown; exp?: unknown };
    return typeof payload.sub === "string" && payload.sub.length > 0 && typeof payload.exp === "number" && payload.exp > Math.floor(Date.now() / 1000);
  } catch { return false; }
}

export function setStaffCookie(response: NextResponse, value: string, maxAge: number) {
  response.cookies.set(STAFF_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

export function clearStaffCookie(response: NextResponse) {
  response.cookies.set(STAFF_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
}
