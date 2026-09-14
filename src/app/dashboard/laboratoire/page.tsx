import { FlaskConical, CheckCircle2 } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";

export default async function LaboratoirePage() {
  const profile = await getCurrentProfile();
  const club = profile.organisation?.nom ?? "ce club";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-5 h-5 text-brand-400" /> Laboratoire
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Espace d&apos;essai des nouveautés, activé pour {club} uniquement.</p>
      </div>

      <div className="card">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Le module est actif sur {club}</p>
            <p className="text-sm text-gray-500 mt-1">
              Cet onglet n&apos;apparaît que pour les aéroclubs où le module « Laboratoire » est activé dans la console propriétaire.
              Ailleurs, il est absent du menu et son adresse renvoie au tableau de bord.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
