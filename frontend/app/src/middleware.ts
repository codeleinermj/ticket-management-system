import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = ["/login", "/register"];

function getRoleFromToken(token: string): string | null {
  try {
    const [, payloadB64] = token.split(".");
    if (!payloadB64) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return payload.role || null;
  } catch {
    return null;
  }
}

function getRoleHome(role: string): string {
  switch (role) {
    case "USER":
      return "/portal";
    case "AGENT":
      return "/dashboard";
    case "ADMIN":
      return "/admin";
    default:
      return "/portal";
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  const accessToken = request.cookies.get("accessToken")?.value;
  const hasSession =
    !!accessToken || request.cookies.has("refreshToken");

  if (!isPublicPath && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublicPath && hasSession) {
    const role = accessToken ? getRoleFromToken(accessToken) : null;
    return NextResponse.redirect(new URL(getRoleHome(role || "USER"), request.url));
  }

  // Role-based route protection for authenticated users
  if (hasSession && accessToken) {
    const role = getRoleFromToken(accessToken);
    if (role) {
      const home = getRoleHome(role);

      // Root path redirect
      if (pathname === "/") {
        return NextResponse.redirect(new URL(home, request.url));
      }

      // USER can only access /portal
      if (role === "USER" && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
        return NextResponse.redirect(new URL("/portal", request.url));
      }

      // AGENT can only access /dashboard
      if (role === "AGENT" && (pathname.startsWith("/portal") || pathname.startsWith("/admin"))) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      // ADMIN can access /admin and /dashboard (inherits agent permissions), not /portal
      if (role === "ADMIN" && pathname.startsWith("/portal")) {
        return NextResponse.redirect(new URL("/admin", request.url));
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*$).*)",
  ],
};
