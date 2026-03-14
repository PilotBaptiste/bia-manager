"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plane, Eye, EyeOff, Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Supabase envoie le token via le hash de l'URL (#access_token=...)
    // Le client Supabase le gère automatiquement à l'initialisation
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
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
      setError("Lien expiré ou invalide. Contactez l'administrateur.");
      return;
    }
    setSuccess(true);
    setTimeout(() => router.push("/dashboard"), 2000);
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
              <p className="text-sm text-white/70">Aéro-Club du Bassin d&apos;Arcachon</p>
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4">Créez votre mot de passe</h2>
          <p className="text-white/80 text-lg">
            Choisissez un mot de passe sécurisé pour accéder à votre espace parent.
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
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Définir mon mot de passe</h2>
          <p className="text-gray-500 mb-6">Créez votre accès à l&apos;espace parent</p>

          {success ? (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium">
              ✅ Mot de passe créé ! Redirection en cours…
            </div>
          ) : (
            <>
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
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
