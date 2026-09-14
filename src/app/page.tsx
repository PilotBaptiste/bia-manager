import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Plane, School, FileSignature, CalendarDays, Euro, ShieldCheck } from "lucide-react";
import { isRootHost } from "@/lib/tenant";

const FEATURES = [
  { icon: School, title: "Inscriptions en ligne", text: "Chaque établissement reçoit un code : les familles inscrivent leurs enfants en quelques minutes." },
  { icon: FileSignature, title: "Attestations signées", text: "Autorisations parentales signées en ligne, archivées et téléchargeables à tout moment." },
  { icon: CalendarDays, title: "Planning des vols", text: "Créneaux par pilote et par avion, réservations des familles, rappels et clôture des vols." },
  { icon: Euro, title: "Finances et subventions", text: "Paiements, coût des vols, subventions par établissement et relevé de compte exportable." },
];

export default async function Home() {
  if (!isRootHost((await headers()).get("host"))) redirect("/auth/connexion");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm">
              <Plane className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="text-sm font-bold text-brand-500">BIA Manager</span>
          </div>
          <Link href="/auth/connexion" className="btn-primary btn-sm">Accès aéroclubs</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-brand-500 text-white">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-16 sm:py-24">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">Brevet d&apos;Initiation Aéronautique</p>
            <h1 className="text-3xl sm:text-5xl font-bold max-w-2xl leading-tight text-balance">
              Le BIA de votre aéroclub, de l&apos;inscription au vol.
            </h1>
            <p className="mt-5 text-lg text-white/80 max-w-xl">
              BIA Manager réunit les établissements, les familles, les pilotes et la trésorerie dans un seul outil.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/connexion" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-brand-500 hover:bg-brand-50 transition-colors">
                Se connecter
              </Link>
            </div>
          </div>
        </section>

        <section className="max-w-[1100px] mx-auto px-4 sm:px-6 py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="card">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5 text-brand-500" />
                </div>
                <h2 className="text-base font-semibold text-gray-900">{f.title}</h2>
                <p className="text-sm text-gray-500 mt-1">{f.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-brand-100 bg-brand-50 p-4">
            <ShieldCheck className="w-5 h-5 text-brand-500 shrink-0 mt-0.5" />
            <p className="text-sm text-brand-600">
              Chaque aéroclub dispose de son propre espace : ses élèves, ses pilotes et ses finances ne sont visibles que par lui.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-5 text-xs text-gray-400">
          © {new Date().getFullYear()} BIA Manager
        </div>
      </footer>
    </div>
  );
}
