import { NextRequest, NextResponse } from "next/server";

// Public routes that don't require auth
const PUBLIC = ["/", "/u/"];
const API    = ["/api/webhook", "/api/click", "/api/cron"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow all public and API paths through
  if (
    PUBLIC.some(p => pathname === p || pathname.startsWith("/u/")) ||
    API.some(p => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // Auth is handled client-side by Firebase in app/dashboard/layout.tsx.
  // This middleware cannot validate that state because the app does not set
  // a Firebase session cookie, so dashboard routes must pass through.

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
