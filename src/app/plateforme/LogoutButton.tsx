"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    await createClient().auth.signOut();
    router.push("/auth/connexion");
    router.refresh();
  }

  return (
    <button onClick={logout} className="btn-secondary btn-sm" title="Se déconnecter">
      <LogOut className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Déconnexion</span>
    </button>
  );
}
