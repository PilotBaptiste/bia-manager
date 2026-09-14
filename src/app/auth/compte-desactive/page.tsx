"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function CompteDesactivePage() {
  useEffect(() => {
    createClient().auth.signOut();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="card max-w-md text-center space-y-3">
        <h1 className="text-lg font-bold text-gray-900">Compte désactivé</h1>
        <p className="text-sm text-gray-500">
          Votre accès à BIA Manager a été désactivé. Contactez votre aéroclub si vous pensez qu&apos;il s&apos;agit d&apos;une erreur.
        </p>
        <a href="/auth/connexion" className="btn-primary inline-flex">Retour à la connexion</a>
      </div>
    </div>
  );
}
