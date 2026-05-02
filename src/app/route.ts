import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function GET(request: NextRequest) {
  const locale = request.cookies.get("NEXT_LOCALE")?.value || "es";
  return NextResponse.redirect(new URL(`/${locale}`, request.url));
}
