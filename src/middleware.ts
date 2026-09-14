import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROOT_DOMAIN, ORG_SLUG_HEADER, authCookieOptions, clubUrl, isRootHost, platformUrl, slugFromHost } from "@/lib/tenant";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const slug = slugFromHost(host);

  // The club slug header is derived from the host only; never trust a client-sent value.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete(ORG_SLUG_HEADER);
  if (slug) requestHeaders.set(ORG_SLUG_HEADER, slug);

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(authCookieOptions ? { cookieOptions: authCookieOptions } : {}),
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  const { pathname, search } = request.nextUrl;
  const origin = request.nextUrl.origin;
  const isAuth = pathname.startsWith("/auth/");
  const isApi = pathname.startsWith("/api/");
  const isInscription = pathname.startsWith("/inscription");
  const isLoginPage = pathname === "/auth/connexion";
  const isRoot = pathname === "/";
  const isPlatform = pathname.startsWith("/plateforme");

  const redirectTo = (url: string) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  if (!user && !isAuth && !isApi && !isInscription && !isRoot) {
    return redirectTo(new URL("/auth/connexion", request.url).toString());
  }

  // Subdomain routing: send each signed-in user to their own club's site.
  if (ROOT_DOMAIN && user && !isApi && !pathname.startsWith("/auth/callback") && !pathname.startsWith("/auth/set-password")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles, organisation:organisations(slug)")
      .eq("id", user.id)
      .single();
    const roles: string[] = profile?.roles || [];
    const isOwner = roles.includes("proprietaire");
    const ownSlug: string | undefined = (profile?.organisation as any)?.slug;

    if (isRootHost(host)) {
      if (isOwner) {
        if (!isPlatform && !isAuth) return redirectTo(platformUrl("/plateforme", origin));
      } else if (ownSlug) {
        return redirectTo(clubUrl(ownSlug, isRoot || isLoginPage ? "/dashboard" : `${pathname}${search}`, origin));
      }
    } else if (slug) {
      if (isPlatform) return redirectTo(platformUrl(`${pathname}${search}`, origin));
      if (ownSlug && slug !== ownSlug) {
        // The owner works inside one club at a time: switching clubs goes through the platform console.
        return redirectTo(isOwner
          ? platformUrl(`/plateforme?club=${encodeURIComponent(slug)}`, origin)
          : clubUrl(ownSlug, "/dashboard", origin));
      }
    }
  }

  // Only bounce logged-in users away from the login page itself,
  // NOT from /auth/set-password or /auth/callback (they need those)
  if (user && (isLoginPage || isRoot)) {
    return redirectTo(new URL("/dashboard", request.url).toString());
  }
  return supabaseResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
