"use client";
import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Plane, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

function ConnexionInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    if (searchParams.get("error")) {
      setError("Le lien est invalide ou expiré. Demandez un nouveau lien ci-dessous.");
      setResetMode(true);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Email ou mot de passe incorrect.");
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/set-password`,
    });
    setResetLoading(false);
    if (error) {
      setError(`Erreur: ${error.message}`);
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 bg-brand-500 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative z-10 max-w-md text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">BIA Manager</h1>
              <p className="text-sm text-white/70">
                Aéro-Club du Bassin d&apos;Arcachon
              </p>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4">Gestion simplifiée du BIA</h2>
          <p className="text-white/80 text-lg">
            Inscriptions, attestations parentales, planning des vols, suivi
            financier.
          </p>
        </div>
      </div>
      <div className="flex w-full lg:w-1/2 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-brand-500">BIA Manager</h1>
              <p className="text-xs text-gray-500">ACBA</p>
            </div>
          </div>

          {resetMode ? (
            <>
              <button
                onClick={() => { setResetMode(false); setResetSent(false); setError(null); }}
                className="text-xs text-gray-400 hover:text-gray-600 mb-4 flex items-center gap-1"
              >
                ← Retour à la connexion
              </button>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Mot de passe oublié</h2>
              <p className="text-gray-500 mb-6">
                Entrez votre email pour recevoir un lien de réinitialisation.
              </p>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              {resetSent ? (
                <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                  <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">Email envoyé !</p>
                    <p className="text-sm text-emerald-700">
                      Vérifiez votre boîte mail et cliquez sur le lien pour définir un nouveau mot de passe.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleReset} className="space-y-4">
                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      className="input"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="btn-primary w-full justify-center"
                  >
                    {resetLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Envoyer le lien"
                    )}
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Connexion</h2>
              <p className="text-gray-500 mb-6">Accédez à votre espace</p>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Se connecter"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setResetMode(true); setResetEmail(email); setError(null); }}
                  className="w-full text-center text-xs text-gray-400 hover:text-brand-500 transition-colors pt-1"
                >
                  Mot de passe oublié ?
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConnexionPage() {
  return (
    <Suspense>
      <ConnexionInner />
    </Suspense>
  );
}
