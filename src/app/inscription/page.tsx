"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plane, Loader2, ArrowRight, AlertCircle } from "lucide-react";

export default function InscriptionPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/inscription?code=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Code invalide");
      setLoading(false);
      return;
    }
    router.push(`/inscription/${trimmed}`);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-10 justify-center">
          <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Plane className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg leading-none">BIA Manager</p>
            <p className="text-white/50 text-xs">Aéro-Club du Bassin d'Arcachon</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Inscription BIA</h1>
          <p className="text-sm text-gray-500 mb-8">
            Entrez le code à 8 caractères fourni par votre établissement.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Code établissement
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase());
                  setError(null);
                }}
                placeholder="ex : AB3K7M2X"
                maxLength={10}
                autoFocus
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-xl font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 rounded-xl text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full flex items-center justify-center gap-2 bg-blue-900 hover:bg-blue-800 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>Accéder à l'inscription <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Déjà un compte ?{" "}
            <a href="/auth/connexion" className="text-blue-600 font-semibold hover:underline">
              Se connecter
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
