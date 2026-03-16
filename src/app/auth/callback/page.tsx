"use client";
import { useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    async function handle() {
      const next = searchParams.get("next") ?? "/auth/set-password";
      const code = searchParams.get("code");

      // PKCE flow (code in query param)
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          if (data.user?.email) {
            await supabase
              .from("eleves")
              .update({ parent_id: data.user.id })
              .eq("parent_email", data.user.email)
              .is("parent_id", null);
          }
          router.replace(next);
          return;
        }
      }

      // Implicit flow (tokens in URL fragment — invite & recovery links)
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          if (data.user?.email) {
            await supabase
              .from("eleves")
              .update({ parent_id: data.user.id })
              .eq("parent_email", data.user.email)
              .is("parent_id", null);
          }
          router.replace(next);
          return;
        }
      }

      // Nothing worked
      router.replace("/auth/connexion?error=lien_invalide_ou_expire");
    }

    handle();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
