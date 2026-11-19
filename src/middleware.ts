import { NextResponse, type NextRequest } from "next/server";

// Pemeriksaan ringan: tanpa cookie sesi → arahkan ke /login.
// Verifikasi tanda tangan sesi dilakukan di server (requireUser).
export function middleware(req: NextRequest) {
  if (!req.cookies.get("epr_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api/health|_next/static|_next/image|favicon.ico).*)"],
};
