import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;
  const isAuth = pathname.startsWith("/auth/");
  const isApi = pathname.startsWith("/api/");
  const isInscription = pathname.startsWith("/inscription");
  const isLoginPage = pathname === "/auth/connexion";
  const isRoot = pathname === "/";

  if (!user && !isAuth && !isApi && !isInscription && !isRoot) {
    return NextResponse.redirect(new URL("/auth/connexion", request.url));
  }
  // Only bounce logged-in users away from the login page itself,
  // NOT from /auth/set-password or /auth/callback (they need those)
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if (user && isRoot) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
