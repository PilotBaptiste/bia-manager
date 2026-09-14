import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import {
  Plane, School, FileSignature, CalendarDays, Euro, BarChart2, Mail, Users, UserCheck, Building2,
  ShieldCheck, Lock, KeyRound, FileCheck2, CheckCircle2, ArrowRight, ChevronDown,
} from "lucide-react";
import { isRootHost } from "@/lib/tenant";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "BIA Manager — Le BIA de votre aéroclub, de l'inscription au vol",
  description:
    "Inscriptions en ligne, attestations parentales signées, planning des vols de découverte et finances : l'outil des aéroclubs pour organiser le Brevet d'Initiation Aéronautique.",
};

const AUDIENCES = [
  { icon: Building2, title: "Aéroclubs", text: "Une vue complète du BIA : élèves, vols, pilotes, finances et subventions, année après année." },
  { icon: School, title: "Établissements", text: "Les coordinateurs suivent leurs élèves et les inscriptions de leur lycée ou collège." },
  { icon: Users, title: "Familles", text: "Inscription, attestation et réservation du vol en ligne, avec rappels par email." },
  { icon: UserCheck, title: "Pilotes", text: "Leurs créneaux, les élèves à bord et la clôture du vol en quelques secondes." },
];

const FEATURES = [
  { icon: School, title: "Inscriptions par code", text: "Chaque établissement reçoit son code. Les parents inscrivent leurs enfants eux-mêmes, avec quota par établissement." },
  { icon: FileSignature, title: "Attestations signées en ligne", text: "L'autorisation parentale est signée sur téléphone, générée en PDF et archivée automatiquement." },
  { icon: CalendarDays, title: "Planning des vols", text: "Créneaux par pilote et par avion, places contrôlées, réservation des familles et clôture avec numéro Aérogest." },
  { icon: Euro, title: "Finances claires", text: "Paiements, coût réel des vols, tarifs horaires datés, subventions par établissement et relevé de compte." },
  { icon: BarChart2, title: "Statistiques", text: "Coût moyen par élève, biplace ou quadriplace, taux de réussite au BIA et suivi par établissement." },
  { icon: Mail, title: "Emails automatiques", text: "Confirmations, rappels, changements de pilote : chaque famille est prévenue au bon moment." },
];

const STEPS = [
  { title: "L'aéroclub prépare l'année", text: "Établissements, avions, tarifs et pilotes : tout est paramétré en une fois." },
  { title: "Les familles s'inscrivent", text: "Avec le code de l'établissement, depuis un téléphone ou un ordinateur." },
  { title: "Attestation et paiement", text: "Signature en ligne de l'autorisation parentale, suivi des règlements." },
  { title: "Réservation du vol", text: "Les parents choisissent un créneau ; les places sont vérifiées en temps réel." },
  { title: "Vol et clôture", text: "Le pilote clôture le vol : temps, coût et finances se mettent à jour d'eux-mêmes." },
];

const SECURITY = [
  { icon: Lock, title: "Un espace par aéroclub", text: "Les données d'un club ne sont jamais visibles par un autre : l'isolation est appliquée par la base de données elle-même." },
  { icon: KeyRound, title: "Accès par rôle", text: "Admin du club, coordinateur, pilote, parent : chacun ne voit que ce qui le concerne." },
  { icon: FileCheck2, title: "Données de mineurs protégées", text: "Attestations et coordonnées ne sont accessibles qu'aux personnes autorisées, jamais publiquement." },
];

const FAQ = [
  { q: "Faut-il installer quelque chose ?", a: "Non. BIA Manager fonctionne dans le navigateur, sur ordinateur, tablette et téléphone. Chaque aéroclub dispose de sa propre adresse." },
  { q: "Les familles doivent-elles créer un compte ?", a: "Oui, au moment de l'inscription avec le code de l'établissement. Elles retrouvent ensuite l'attestation, le paiement et la réservation du vol dans leur espace." },
  { q: "Peut-on reprendre les élèves déjà inscrits ?", a: "Oui. Les élèves peuvent être importés depuis un fichier Excel ou CSV, puis complétés par les familles." },
  { q: "Comment fonctionne le multi-établissements ?", a: "Un aéroclub gère autant de lycées et collèges qu'il le souhaite, avec des créneaux réservés à un ou plusieurs établissements." },
];

export default async function Home() {
  if (!isRootHost((await headers()).get("host"))) redirect("/auth/connexion");

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm">
              <Plane className="w-[18px] h-[18px] text-white" />
            </div>
            <span className="text-[15px] font-bold text-brand-500">BIA Manager</span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm text-gray-500" aria-label="Sections">
            <a href="#fonctionnalites" className="hover:text-brand-500 transition-colors">Fonctionnalités</a>
            <a href="#fonctionnement" className="hover:text-brand-500 transition-colors">Fonctionnement</a>
            <a href="#securite" className="hover:text-brand-500 transition-colors">Sécurité</a>
            <a href="#faq" className="hover:text-brand-500 transition-colors">Questions</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/connexion" className="hidden sm:inline-flex btn-secondary btn-sm">Se connecter</Link>
            <a href="#contact" className="btn-primary btn-sm">Nous contacter</a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-500 text-white">
          <div className="absolute -top-24 -right-24 w-[420px] h-[420px] rounded-full bg-brand-400/40 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-24 grid lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                <Plane className="w-3.5 h-3.5" /> Brevet d&apos;Initiation Aéronautique
              </p>
              <h1 className="mt-5 text-4xl sm:text-5xl font-bold leading-[1.1] text-balance">
                Le BIA de votre aéroclub, de l&apos;inscription au vol.
              </h1>
              <p className="mt-5 text-lg text-white/75 max-w-xl">
                Établissements, familles, pilotes et trésorerie réunis dans un seul outil. Fini les tableurs, les attestations papier et les relances à la main.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#contact" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-brand-500 hover:bg-brand-50 transition-colors">
                  Équiper mon aéroclub <ArrowRight className="w-4 h-4" />
                </a>
                <Link href="/auth/connexion" className="inline-flex items-center gap-2 rounded-lg border border-white/25 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                  J&apos;ai déjà un accès
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
                {["Inscriptions en ligne", "Attestations signées", "Finances à jour"].map((t) => (
                  <li key={t} className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-300" /> {t}</li>
                ))}
              </ul>
            </div>

            {/* Product preview */}
            <div className="relative" aria-hidden="true">
              <div className="rounded-2xl bg-white text-gray-900 shadow-2xl ring-1 ring-black/5 p-5 rotate-[0.6deg]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold">Tableau de bord</p>
                    <p className="text-[11px] text-gray-400">Année 2026-2027 · aperçu</p>
                  </div>
                  <span className="badge bg-emerald-50 text-emerald-600">Saison en cours</span>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { l: "Élèves", v: "130", c: "bg-brand-50 text-brand-500" },
                    { l: "Vol 1 effectués", v: "112", c: "bg-amber-50 text-amber-600" },
                    { l: "Attestations", v: "124", c: "bg-emerald-50 text-emerald-600" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl border border-gray-100 p-3">
                      <div className={`w-7 h-7 rounded-lg ${s.c.split(" ")[0]} flex items-center justify-center mb-2`}>
                        <Plane className={`w-3.5 h-3.5 ${s.c.split(" ")[1]}`} />
                      </div>
                      <p className="text-xl font-bold tabular-nums">{s.v}</p>
                      <p className="text-[10px] text-gray-400">{s.l}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-gray-100 divide-y divide-gray-100">
                  {[
                    { d: "Sam. 12 oct.", h: "09:00", a: "DR400 · F-GJKL", p: "3/3", ok: true },
                    { d: "Sam. 12 oct.", h: "10:30", a: "C172 · F-HBXA", p: "2/3", ok: false },
                    { d: "Dim. 13 oct.", h: "14:00", a: "DR400 · F-GJKL", p: "1/3", ok: false },
                  ].map((r) => (
                    <div key={r.h + r.d} className="flex items-center gap-3 px-3 py-2.5 text-xs">
                      <span className="w-20 text-gray-500">{r.d}</span>
                      <span className="font-mono text-gray-700">{r.h}</span>
                      <span className="flex-1 text-gray-600 truncate">{r.a}</span>
                      <span className={`badge ${r.ok ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-500"}`}>{r.p} élèves</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-6 -left-4 sm:-left-8 rounded-xl bg-white text-gray-900 shadow-xl ring-1 ring-black/5 px-4 py-3 flex items-center gap-3 -rotate-[1.5deg]">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <FileSignature className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Attestation signée</p>
                  <p className="text-[11px] text-gray-400">PDF archivé automatiquement</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Audiences */}
        <section className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Pour tout le monde</p>
            <h2 className="mt-2 text-3xl font-bold text-balance">Chacun son espace, une seule organisation.</h2>
          </div>
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {AUDIENCES.map((a) => (
              <div key={a.title} className="rounded-2xl border border-gray-200 p-5 hover:border-brand-200 hover:shadow-sm transition">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center mb-4">
                  <a.icon className="w-5 h-5 text-brand-500" />
                </div>
                <h3 className="font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500">{a.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="fonctionnalites" className="bg-gray-50 border-y border-gray-100 scroll-mt-16">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Fonctionnalités</p>
              <h2 className="mt-2 text-3xl font-bold text-balance">Tout le BIA, sans tableur.</h2>
              <p className="mt-3 text-gray-500">Pensé avec un aéroclub qui organise des vols de découverte pour plus d&apos;une centaine d&apos;élèves chaque année.</p>
            </div>
            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FEATURES.map((f) => (
                <div key={f.title} className="card">
                  <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center mb-4 shadow-sm">
                    <f.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-gray-500">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="fonctionnement" className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Fonctionnement</p>
            <h2 className="mt-2 text-3xl font-bold text-balance">De la rentrée au vol, en cinq étapes.</h2>
          </div>
          <ol className="mt-10 grid md:grid-cols-5 gap-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl border border-gray-200 p-5">
                <span className="flex w-8 h-8 items-center justify-center rounded-full bg-brand-500 text-white text-sm font-bold">{i + 1}</span>
                <h3 className="mt-4 font-semibold text-[15px]">{s.title}</h3>
                <p className="mt-1.5 text-sm text-gray-500">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Security */}
        <section id="securite" className="bg-brand-800 text-white scroll-mt-16">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-[0.9fr_1.1fr] gap-10 items-start">
            <div>
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-brand-200" />
              </div>
              <h2 className="mt-5 text-3xl font-bold text-balance">Des données d&apos;élèves traitées avec sérieux.</h2>
              <p className="mt-3 text-brand-200">Vous gérez des mineurs : BIA Manager est conçu pour que chaque information reste entre les bonnes mains.</p>
            </div>
            <div className="grid gap-4">
              {SECURITY.map((s) => (
                <div key={s.title} className="flex gap-4 rounded-2xl bg-white/5 ring-1 ring-white/10 p-5">
                  <s.icon className="w-5 h-5 text-brand-200 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold">{s.title}</h3>
                    <p className="mt-1 text-sm text-brand-200">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="max-w-[860px] mx-auto px-4 sm:px-6 py-16 sm:py-20 scroll-mt-16">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400 text-center">Questions fréquentes</p>
          <h2 className="mt-2 text-3xl font-bold text-center text-balance">Vous vous demandez peut-être…</h2>
          <div className="mt-10 divide-y divide-gray-200 border-y border-gray-200">
            {FAQ.map((f) => (
              <details key={f.q} className="group py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-gray-900">
                  {f.q}
                  <ChevronDown className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm text-gray-500">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="bg-gray-50 border-t border-gray-100 scroll-mt-16">
          <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-16 sm:py-20 grid lg:grid-cols-[0.8fr_1.2fr] gap-10">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Contact</p>
              <h2 className="mt-2 text-3xl font-bold text-balance">Équipez votre aéroclub.</h2>
              <p className="mt-3 text-gray-500">
                Parlez-nous de votre BIA : nombre d&apos;établissements, d&apos;élèves, organisation actuelle. Nous vous montrons l&apos;outil et préparons votre espace.
              </p>
              <ul className="mt-6 space-y-2.5 text-sm text-gray-600">
                {["Votre adresse dédiée : votre-club.biamanager.com", "Accompagnement pour la première rentrée", "Import de vos élèves existants"].map((t) => (
                  <li key={t} className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" /> {t}</li>
                ))}
              </ul>
            </div>
            <div className="card sm:p-8">
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-[1180px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <Plane className="w-3.5 h-3.5 text-brand-400" />
            <span>© {new Date().getFullYear()} BIA Manager</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="#contact" className="hover:text-brand-500">Contact</a>
            <Link href="/auth/connexion" className="hover:text-brand-500">Accès aéroclubs</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
