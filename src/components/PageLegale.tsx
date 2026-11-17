import Link from "next/link";
import { Plane, ArrowLeft } from "lucide-react";

/** Coquille commune aux pages légales : lisibles sans compte, sur téléphone compris. */
export default function PageLegale({
  titre,
  chapeau,
  children,
}: {
  titre: string;
  chapeau: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="border-b border-gray-200">
        <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-sm font-bold text-brand-600">
            <Plane className="w-4 h-4" /> BIA Manager
          </Link>
          <Link href="/auth/connexion" className="text-xs text-gray-400 hover:text-brand-500">
            Se connecter
          </Link>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-4 sm:px-6 py-10">
        <h1 className="text-2xl font-bold text-gray-900">{titre}</h1>
        <p className="text-sm text-gray-500 mt-2 leading-relaxed">{chapeau}</p>
        <div className="mt-8 space-y-8">{children}</div>

        <div className="mt-12 pt-6 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap text-xs">
          <Link href="/" className="flex items-center gap-1.5 text-gray-400 hover:text-brand-500">
            <ArrowLeft className="w-3.5 h-3.5" /> Retour
          </Link>
          <div className="flex items-center gap-5">
            <Link href="/mentions-legales" className="text-gray-400 hover:text-brand-500">Mentions légales</Link>
            <Link href="/confidentialite" className="text-gray-400 hover:text-brand-500">Confidentialité</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

/** Un bloc de texte titré, avec le rythme de lecture des pages légales. */
export function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-base font-bold text-gray-900 mb-2">{titre}</h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

/** Valeur attendue mais pas encore renseignée : on le dit, on ne l'invente pas. */
export function ACompleter({ quoi }: { quoi: string }) {
  return (
    <span className="inline-block rounded bg-amber-50 text-amber-700 px-1.5 py-0.5 text-xs font-semibold">
      {quoi} — à compléter
    </span>
  );
}
