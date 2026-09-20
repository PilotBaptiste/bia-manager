import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  ROOT_DOMAIN, ORG_SLUG_HEADER, authCookieOptionsFor, clubUrl, isAdminHost, isRootHost, platformUrl, slugFromHost,
} from "@/lib/tenant";

export async function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const slug = slugFromHost(host);
  const authCookieOptions = authCookieOptionsFor(host);
  const onShowcase = isRootHost(host);
  const onAdmin = isAdminHost(host);

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
  // Le désabonnement se fait depuis un lien reçu par email, sans connexion.
  const isDesabonnement = pathname.startsWith("/desabonnement");
  const isLoginPage = pathname === "/auth/connexion";
  const isRoot = pathname === "/";
  const isPlatform = pathname.startsWith("/plateforme");

  const redirectTo = (url: string) => {
    const res = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  const isOwnerLogin = pathname.startsWith("/auth/proprietaire");

  if (ROOT_DOMAIN && !isApi) {
    // The owner console and its login only exist on admin.<domain>; anywhere else they answer "not found".
    if ((isPlatform || isOwnerLogin) && !onAdmin) {
      return NextResponse.rewrite(new URL("/page-introuvable", request.url), { status: 404 });
    }
    // On admin.<domain>, the regular login is replaced by the dedicated owner login.
    if (onAdmin && isLoginPage && !user) {
      return NextResponse.rewrite(new URL("/auth/proprietaire", request.url));
    }
    // The showcase home page is public, signed in or not.
    if (onShowcase && isRoot) return supabaseResponse;
  }

  if (!user && !isAuth && !isApi && !isInscription && !isDesabonnement && !(isRoot && !slug && !onAdmin)) {
    return redirectTo(new URL("/auth/connexion", request.url).toString());
  }
  if (onAdmin && !user && isInscription) {
    return redirectTo(new URL("/auth/connexion", request.url).toString());
  }

  // Subdomain routing: send each signed-in user to the right site.
  if (ROOT_DOMAIN && user && !isApi && !pathname.startsWith("/auth/callback") && !pathname.startsWith("/auth/set-password")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("roles, organisation:organisations(slug)")
      .eq("id", user.id)
      .single();
    const roles: string[] = profile?.roles || [];
    const isOwner = roles.includes("proprietaire");
    const ownSlug: string | undefined = (profile?.organisation as any)?.slug;

    if (onAdmin) {
      if (!isOwner) {
        return redirectTo(ownSlug ? clubUrl(ownSlug, "/dashboard", origin) : new URL("/auth/connexion", request.url).toString());
      }
      if (!isPlatform) return redirectTo(platformUrl("/plateforme", origin));
    } else if (onShowcase) {
      if (ownSlug) return redirectTo(clubUrl(ownSlug, isLoginPage ? "/dashboard" : `${pathname}${search}`, origin));
    } else if (slug && ownSlug && slug !== ownSlug) {
      // The owner works inside one club at a time: switching clubs goes through the console.
      return redirectTo(isOwner
        ? platformUrl(`/plateforme?club=${encodeURIComponent(slug)}`, origin)
        : clubUrl(ownSlug, "/dashboard", origin));
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
