"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Eye, EyeOff, Loader2, LockKeyhole, ShieldCheck, CheckCircle } from "lucide-react";

export default function ConnexionProprietairePage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { data, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
    if (authErr || !data.user) {
      setError("Identifiants incorrects.");
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("roles").eq("id", data.user.id).single();
    if (!(profile?.roles || []).includes("proprietaire")) {
      await supabase.auth.signOut();
      setError("Cet espace est réservé à l'équipe BIA Manager. Connectez-vous depuis le site de votre aéroclub.");
      setLoading(false);
      return;
    }
    window.location.href = "/plateforme";
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Envoi impossible pour le moment. Réessayez dans quelques minutes.");
      return;
    }
    setResetSent(true);
  }

  return (
    <div className="min-h-screen bg-brand-800 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6 text-brand-200">
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[11px] font-semibold uppercase tracking-wider">Accès réservé</span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-brand-800 flex items-center justify-center shrink-0">
              <LockKeyhole className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Console propriétaire</h1>
              <p className="text-xs text-gray-500">BIA Manager · administration de la plateforme</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
          )}

          {resetMode ? (
            resetSent ? (
              <div className="flex items-start gap-3 rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-700">Si un compte existe pour cette adresse, un lien de réinitialisation vient d&apos;être envoyé.</p>
              </div>
            ) : (
              <form onSubmit={handleReset} className="space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required autoFocus />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Recevoir un lien"}
                </button>
                <button type="button" onClick={() => { setResetMode(false); setError(null); }} className="w-full text-center text-xs text-gray-400 hover:text-brand-500">
                  ← Retour à la connexion
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="label">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" required autoFocus autoComplete="username" />
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
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}>
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Accéder à la console"}
              </button>
              <button type="button" onClick={() => { setResetMode(true); setError(null); }} className="w-full text-center text-xs text-gray-400 hover:text-brand-500">
                Mot de passe oublié ?
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-xs text-brand-300 mt-6">
          Vous êtes parent, pilote ou membre d&apos;un aéroclub ? Connectez-vous depuis le site de votre club.
        </p>
      </div>
    </div>
  );
}
