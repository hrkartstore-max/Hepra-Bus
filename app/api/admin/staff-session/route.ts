import { NextRequest, NextResponse } from "next/server";
import { verifyStaffSession } from "../../../../lib/staff-session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { ok: verifyStaffSession(request) },
    { headers: { "Cache-Control": "no-store, max-age=0", "X-Robots-Tag": "noindex, nofollow" } },
  );
}
