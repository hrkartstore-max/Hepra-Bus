import { NextResponse } from "next/server";
import { clearStaffCookie } from "../../../../lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  clearStaffCookie(response);
  return response;
}
