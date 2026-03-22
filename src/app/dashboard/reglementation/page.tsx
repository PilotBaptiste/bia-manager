"use client";

import { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
  Plane,
  Clock,
  BookOpen,
  Shield,
  FileText,
  Users,
  Award,
  ExternalLink,
} from "lucide-react";

type Section = {
  id: string;
  icon: React.ReactNode;
  title: string;
  color: string;
  bg: string;
  border: string;
  rules: { ok: boolean; text: string; detail?: string }[];
  detail?: React.ReactNode;
};

const sections: Section[] = [
  {
    id: "qualifications",
    icon: <Shield size={20} />,
    title: "Qualifications du pilote",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    rules: [
      {
        ok: true,
        text: "Instructeur FI ou FE",
        detail: "Recommandé par la FFA — peut réaliser un vol unique de 55 min.",
      },
      {
        ok: true,
        text: "Pilote « Vols de Découverte »",
        detail:
          "Peut effectuer des vols BIA de 30 minutes maximum chacun (plusieurs vols pour atteindre les 55 min). La FFA recommande également la détention du CAEA, sans l'exiger.",
      },
      {
        ok: false,
        text: "Tout autre pilote",
        detail:
          "Non autorisé à effectuer des vols BIA sans qualification VD ou statut instructeur.",
      },
    ],
    detail: (
      <div className="mt-3 p-3 bg-blue-100 rounded-lg text-sm text-blue-800">
        <strong>Source :</strong> Note DGAC (Annexe 5 du Guide Actions Jeunes FFA 2025-2026) et pages 7-8 du guide.
      </div>
    ),
  },
  {
    id: "licence",
    icon: <Award size={20} />,
    title: "Licence FFA",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    rules: [
      {
        ok: true,
        text: "Licence FFA à jour pour l'année en cours",
        detail:
          "Obligatoire au moment du vol BIA. Sans licence FFA valide, le vol ne peut pas être comptabilisé pour la prime.",
      },
      {
        ok: false,
        text: "Licence FFA expirée ou non renouvelée",
        detail: "Le vol ne pourra pas ouvrir droit à la prime FFA de 50 €.",
      },
    ],
  },
  {
    id: "duree",
    icon: <Clock size={20} />,
    title: "Durée de vol",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    rules: [
      {
        ok: true,
        text: "Minimum 55 minutes en place avant (co-pilote)",
        detail:
          "Ces 55 minutes doivent être effectuées par l'élève en place avant (co-pilote), à vocation pédagogique.",
      },
      {
        ok: true,
        text: "En 1 seul vol — si instructeur FI/FE",
        detail: "Un instructeur peut réaliser le vol complet d'un coup.",
      },
      {
        ok: true,
        text: "En plusieurs vols de ≤ 30 min — si pilote VD",
        detail:
          "Les vols doivent tous être effectués par le même aéroclub ayant déclaré l'élève sur SMILE.",
      },
      {
        ok: false,
        text: "Vols > 30 min par un pilote non-instructeur",
        detail: "Seuls les instructeurs peuvent dépasser 30 minutes par vol.",
      },
    ],
  },
  {
    id: "aeronef",
    icon: <Plane size={20} />,
    title: "L'aéronef",
    color: "text-green-700",
    bg: "bg-green-50",
    border: "border-green-200",
    rules: [
      {
        ok: true,
        text: "Appartenant à l'aéroclub ou exploité par lui",
        detail: "L'avion utilisé doit être la propriété de l'aéroclub ou être sous sa responsabilité d'exploitation.",
      },
      {
        ok: true,
        text: "Couvert par une assurance RC valide",
        detail:
          "L'aéroclub doit avoir souscrit une police d'assurance responsabilité civile pour l'aéronef (cf. Art. 3 de la convention type).",
      },
      {
        ok: true,
        text: "Aérodrome de départ = Aérodrome d'arrivée",
        detail: "Le vol BIA doit se terminer sur le même aérodrome que celui de départ. Aucun posé sur un terrain extérieur n'est autorisé.",
      },
      {
        ok: false,
        text: "Avion personnel du pilote non exploité par le club",
        detail: "Non éligible pour les vols BIA.",
      },
      {
        ok: false,
        text: "Posé sur un terrain extérieur",
        detail: "Strictement interdit — le vol doit obligatoirement revenir à l'aérodrome de départ.",
      },
    ],
  },
  {
    id: "carnet",
    icon: <BookOpen size={20} />,
    title: "Carnet de route",
    color: "text-slate-700",
    bg: "bg-slate-50",
    border: "border-slate-200",
    rules: [
      {
        ok: true,
        text: 'Colonne NOMS : "Dupont (BIA : Durand)"',
        detail:
          'Format imposé : Nom du pilote suivi entre parenthèses de "BIA :" et du nom du stagiaire.',
      },
      {
        ok: true,
        text: 'Colonne FONCTIONS : "P"',
        detail: "Pour les instructeurs FI et les pilotes Vols de Découverte.",
      },
    ],
    detail: (
      <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
        <AlertTriangle size={14} className="inline mr-1" />
        <strong>Attention :</strong> Des contrôles aléatoires des carnets de route sont effectués par la FFA.
      </div>
    ),
  },
  {
    id: "eleve",
    icon: <Users size={20} />,
    title: "Conditions relatives à l'élève",
    color: "text-rose-700",
    bg: "bg-rose-50",
    border: "border-rose-200",
    rules: [
      {
        ok: true,
        text: "Élève de moins de 21 ans (né après le 01/01/2005)",
        detail: "Condition pour l'attribution de la prime FFA de 50 €.",
      },
      {
        ok: true,
        text: "Déclaré sur SMILE par l'aéroclub avant le 20 déc. 2025",
        detail: "Sans déclaration sur SMILE dans les délais, aucune prime ne peut être versée.",
      },
      {
        ok: true,
        text: "L'élève n'a pas besoin d'être adhérent de l'aéroclub",
        detail: "La souscription à l'aéroclub n'est pas obligatoire pour réaliser un vol BIA.",
      },
      {
        ok: false,
        text: "Élève déjà engagé en formation LAPL/PPL dans un club fédéral",
        detail:
          "Ne peut pas bénéficier des avantages de la licence Jeunes Ailes ni de la prime de 50 €.",
      },
    ],
  },
  {
    id: "prime",
    icon: <FileText size={20} />,
    title: "Prime FFA 50 € — conditions cumulatives",
    color: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
    rules: [
      { ok: true, text: "Élève déclaré sur SMILE avant le 20 déc. 2025" },
      { ok: true, text: "Formation théorique complète (~40 heures)" },
      { ok: true, text: "Élève admis à l'examen BIA (session mai/juin 2026)" },
      { ok: true, text: "55 minutes minimum de vol en place avant effectuées" },
      { ok: true, text: "Temps de vol saisi sur SMILE avant le 31 oct. 2026" },
    ],
    detail: (
      <div className="mt-3 p-3 bg-teal-100 rounded-lg text-sm text-teal-800">
        Les primes sont versées aux aéroclubs en décembre 2026. Elles sont indivisibles et nominatives.
      </div>
    ),
  },
];

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`border rounded-xl overflow-hidden ${section.border}`}>
      <button
        className={`w-full flex items-center justify-between px-4 py-3 ${section.bg} hover:opacity-90 transition`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <div className={`flex items-center gap-2 font-semibold ${section.color}`}>
          {section.icon}
          {section.title}
        </div>
        {open ? (
          <ChevronUp size={18} className={section.color} />
        ) : (
          <ChevronDown size={18} className={section.color} />
        )}
      </button>
      {open && (
        <div className="px-4 py-3 bg-white space-y-2">
          {section.rules.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {r.ok ? (
                <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
              )}
              <div>
                <span className={r.ok ? "text-gray-800" : "text-red-700 font-medium"}>
                  {r.text}
                </span>
                {r.detail && (
                  <p className="text-gray-500 mt-0.5 text-xs leading-relaxed">{r.detail}</p>
                )}
              </div>
            </div>
          ))}
          {section.detail}
        </div>
      )}
    </div>
  );
}

const checklist = [
  { id: "licence", label: "Ma licence FFA est valide pour l'année en cours" },
  {
    id: "qualification",
    label: "Je suis instructeur FI/FE OU titulaire de l'autorisation Vols de Découverte",
  },
  { id: "aeronef", label: "L'aéronef appartient à l'aéroclub ou est exploité par lui" },
  { id: "assurance", label: "L'aéronef est couvert par une assurance RC valide" },
  { id: "duree", label: "Je vais effectuer ≤ 30 min si je suis pilote VD (ou 55 min d'un coup si instructeur)" },
  { id: "eleve", label: "L'élève est bien déclaré sur SMILE par l'aéroclub" },
  { id: "terrain", label: "Le vol revient à l'aérodrome de départ — aucun posé extérieur prévu" },
  { id: "carnet", label: "Je sais comment remplir le carnet de route (format BIA)" },
];

export default function ReglementationPage() {
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const allOk = checklist.every((c) => checked[c.id]);
  const someOk = checklist.some((c) => checked[c.id]);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Réglementation Vols BIA</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Règles FFA / DGAC applicables aux vols de découverte BIA — Guide Actions Jeunes 2025-2026
        </p>
      </div>

      {/* Bandeau info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <Info size={18} className="shrink-0 mt-0.5" />
        <div>
          <strong>Pourquoi ces règles ?</strong> Pour que les vols BIA soient éligibles à la{" "}
          <strong>prime FFA de 50 €</strong> par élève, l&apos;aéroclub et le pilote doivent
          respecter l&apos;ensemble des conditions définies par la DGAC et la FFA. Un seul critère
          non respecté peut entraîner le refus de la prime.
        </div>
      </div>

      {/* Checklist pré-vol */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <CheckCircle size={18} className="text-green-600" />
            Checklist pré-vol pilote
          </h2>
          {allOk ? (
            <span className="text-xs font-medium bg-green-100 text-green-700 px-2 py-1 rounded-full">
              ✅ Tout est bon
            </span>
          ) : someOk ? (
            <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-1 rounded-full">
              ⚠ En cours de vérification
            </span>
          ) : (
            <span className="text-xs font-medium bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              À compléter
            </span>
          )}
        </div>
        <div className="p-4 space-y-3">
          {checklist.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <input
                type="checkbox"
                checked={!!checked[item.id]}
                onChange={(e) =>
                  setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                }
                className="w-4 h-4 accent-green-600 rounded"
              />
              <span
                className={`text-sm transition ${
                  checked[item.id]
                    ? "line-through text-gray-400"
                    : "text-gray-700 group-hover:text-gray-900"
                }`}
              >
                {item.label}
              </span>
            </label>
          ))}
          {allOk && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 font-medium text-center">
              ✅ Vous êtes en conformité pour effectuer ce vol BIA.
            </div>
          )}
        </div>
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
          <button
            onClick={() => setChecked({})}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Réinitialiser la checklist
          </button>
        </div>
      </div>

      {/* Sections réglementaires */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">
          Détail des règles — cliquer pour développer
        </h2>
        <div className="space-y-2">
          {sections.map((s) => (
            <SectionCard key={s.id} section={s} />
          ))}
        </div>
      </div>

      {/* Calendrier clé */}
      <div className="border border-orange-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-orange-50 border-b border-orange-200">
          <h2 className="font-semibold text-orange-800 flex items-center gap-2">
            <Clock size={18} />
            Dates clés à ne pas manquer
          </h2>
        </div>
        <div className="p-4">
          <div className="space-y-2 text-sm">
            {[
              { date: "1er oct. 2025", desc: "Ouverture des déclarations sur SMILE" },
              { date: "20 déc. 2025", desc: "Date limite de déclaration des élèves BIA sur SMILE" },
              { date: "1ère quinz. mars 2026", desc: "Clôture des inscriptions à l'examen BIA" },
              { date: "Mai / juin 2026", desc: "Examen BIA" },
              { date: "31 oct. 2026", desc: "Date limite de saisie des vols BIA + résultats sur SMILE" },
              { date: "Déc. 2026", desc: "Versement des primes FFA de 50 € aux aéroclubs" },
            ].map((item, i) => (
              <div key={i} className="flex gap-3">
                <span className="font-medium text-orange-700 whitespace-nowrap w-44 shrink-0">
                  {item.date}
                </span>
                <span className="text-gray-700">{item.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lien vers le guide */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
        <FileText size={18} className="shrink-0 text-gray-400" />
        <div>
          <p className="font-medium text-gray-800">Guide Actions Jeunes FFA 2025-2026</p>
          <p className="mt-0.5">
            Source officielle :{" "}
            <a
              href="https://www.ffa-aero.fr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline inline-flex items-center gap-1"
            >
              www.ffa-aero.fr
              <ExternalLink size={12} />
            </a>
            {" — "}secretariat@ff-aero.fr
          </p>
        </div>
      </div>
    </div>
  );
}
