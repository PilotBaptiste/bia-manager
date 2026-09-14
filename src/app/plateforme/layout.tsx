import { requireRolePage } from "@/lib/auth";
import { Toaster } from "sonner";
import { Plane } from "lucide-react";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";

export default async function PlateformeLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireRolePage(["proprietaire"]);
  const displayName = [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shrink-0 shadow-sm">
              <Plane className="w-[18px] h-[18px] text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-brand-500 truncate">
                BIA Manager <span className="text-gray-300 font-normal">·</span> Plateforme
              </p>
              <p className="text-[10px] text-gray-400">Console propriétaire</p>
            </div>
          </div>
          <div className="flex items-center gap-3 min-w-0">
            <p className="hidden sm:block text-xs text-gray-500 truncate">{displayName}</p>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="max-w-[1280px] mx-auto p-4 sm:p-6 lg:p-8" aria-label="Contenu principal">
        {children}
      </main>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  );
}
