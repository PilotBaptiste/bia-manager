"use client";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ClubIndisponiblePage() {
  useEffect(() => {
    createClient().auth.signOut();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="card max-w-md text-center space-y-3">
        <h1 className="text-lg font-bold text-gray-900">Accès au club indisponible</h1>
        <p className="text-sm text-gray-500">
          Votre compte n&apos;est rattaché à aucun aéroclub actif. Si votre club vient de rejoindre BIA Manager ou a été suspendu, contactez son responsable.
        </p>
        <a href="/auth/connexion" className="btn-primary inline-flex">Retour à la connexion</a>
      </div>
    </div>
  );
}
