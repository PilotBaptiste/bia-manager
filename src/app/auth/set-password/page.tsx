"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plane, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Verify a session exists (set by the callback route)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true);
      } else {
        router.replace("/auth/connexion");
      }
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    if (password !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(`Erreur: ${err.message}`);
      return;
    }
    // Auto-link children and sync profile name (fire-and-forget)
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      fetch("/api/link-parent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      }).catch(() => {});
    }
    setDone(true);
    setTimeout(() => router.push("/dashboard"), 2000);
  }

  if (!sessionReady) return null;

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
          <h2 className="text-3xl font-bold mb-4">Bienvenue sur BIA Manager</h2>
          <p className="text-white/80 text-lg">
            Définissez votre mot de passe pour accéder à votre espace.
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

          {done ? (
            <div className="text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Mot de passe défini !
              </h2>
              <p className="text-gray-500">Redirection vers votre tableau de bord…</p>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                Définir votre mot de passe
              </h2>
              <p className="text-gray-500 mb-6">
                Choisissez un mot de passe sécurisé pour votre compte.
              </p>
              {error && (
                <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nouveau mot de passe</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input pr-10"
                      placeholder="8 caractères minimum"
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
                <div>
                  <label className="label">Confirmer le mot de passe</label>
                  <input
                    type={showPw ? "text" : "password"}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Enregistrer le mot de passe"
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
