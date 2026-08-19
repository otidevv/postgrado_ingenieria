import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/cookie";

const PUBLIC_PATHS = new Set<string>(["/", "/login", "/403"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.has(pathname) ||
    pathname.startsWith("/diplomado/") ||
    pathname.startsWith("/models/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/dni/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico";

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  if (isPublic) {
    // Nota: el redirect "ya logueado en /login → home" lo hace la propia
    // página de login contra la BD (getCurrentUser). Hacerlo aquí con la
    // cookie firmada provocaba un bucle infinito cuando la cookie era
    // válida pero la sesión ya no existía en la BD (usuario eliminado o
    // sesiones revocadas).
    return NextResponse.next();
  }

  if (!session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static assets and image files
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
