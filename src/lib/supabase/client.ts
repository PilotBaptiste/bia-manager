import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptionsFor } from "@/lib/tenant";

export function createClient() {
  const authCookieOptions = authCookieOptionsFor(typeof window !== "undefined" ? window.location.hostname : null);
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    authCookieOptions ? { cookieOptions: authCookieOptions } : undefined,
  );
}
