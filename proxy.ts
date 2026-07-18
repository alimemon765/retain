import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authToken } from "@/lib/auth";

// Paths reachable without the PIN: the PIN screen itself, the cron route
// (guarded by CRON_SECRET instead), and PWA assets so install/offline works.
const PUBLIC_PATHS = [
  /^\/pin$/,
  /^\/api\/cron\//,
  /^\/manifest\.json$/,
  /^\/sw\.js$/,
  /^\/icons\//,
];

export async function proxy(req: NextRequest) {
  const pin = process.env.APP_PIN;
  if (!pin) return NextResponse.next();

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((r) => r.test(pathname))) return NextResponse.next();

  if (req.cookies.get(AUTH_COOKIE)?.value === (await authToken(pin))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/pin";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
