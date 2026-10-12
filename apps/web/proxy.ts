import { NextResponse, type NextRequest } from "next/server";

const SAFE_ADDRESS = /^[A-Za-z0-9:._-]{1,64}$/;

export function proxy(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const address = SAFE_ADDRESS.test(forwarded) ? forwarded : "unknown";
  const headers = new Headers(request.headers);
  headers.set("x-platform-client-ip", address);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: "/api/:path*",
};
