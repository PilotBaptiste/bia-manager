"use client";

export type Desiderata = {
  lundi_matin?: boolean; lundi_apm?: boolean;
  mardi_matin?: boolean; mardi_apm?: boolean;
  mercredi_matin?: boolean; mercredi_apm?: boolean;
  jeudi_matin?: boolean; jeudi_apm?: boolean;
  vendredi_matin?: boolean; vendredi_apm?: boolean;
  samedi_matin?: boolean; samedi_apm?: boolean;
  dimanche_matin?: boolean; dimanche_apm?: boolean;
  semaine?: "paire" | "impaire" | null;
};

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"] as const;
const LABELS: Record<string, string> = {
  lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu",
  vendredi: "Ven", samedi: "Sam", dimanche: "Dim",
};

export function emptyDesiderata(): Desiderata {
  return {
    lundi_matin: false, lundi_apm: false,
    mardi_matin: false, mardi_apm: false,
    mercredi_matin: false, mercredi_apm: false,
    jeudi_matin: false, jeudi_apm: false,
    vendredi_matin: false, vendredi_apm: false,
    samedi_matin: false, samedi_apm: false,
    dimanche_matin: false, dimanche_apm: false,
    semaine: null,
  };
}

export function fromDb(raw: any): Desiderata {
  if (!raw) return emptyDesiderata();
  return { ...emptyDesiderata(), ...raw };
}

// Returns "match" | "no-match" | "unknown"
export function matchDesiderata(
  desiderata: Desiderata | null | undefined,
  date_vol: string,   // "2026-04-08"
  heure_debut: string // "11:00:00" or "11:00"
): "match" | "no-match" | "unknown" {
  if (!desiderata) return "unknown";
  const hasJourPref = JOURS.some(j => desiderata[`${j}_matin` as keyof Desiderata] || desiderata[`${j}_apm` as keyof Desiderata]);
  if (!hasJourPref && !desiderata.semaine) return "unknown";

  const date = new Date(date_vol + "T00:00:00");
  const dayNames = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
  const jour = dayNames[date.getDay()];
  const hour = parseInt(heure_debut?.slice(0, 2) ?? "0");
  const moment = hour < 13 ? "matin" : "apm";

  // Week parity — ISO week, week 1 of 2026 = reference (odd)
  let weekOk = true;
  if (desiderata.semaine) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    const isPaire = isoWeek % 2 === 0;
    weekOk = desiderata.semaine === "paire" ? isPaire : !isPaire;
  }

  if (hasJourPref && !desiderata[`${jour}_${moment}` as keyof Desiderata]) return "no-match";
  if (!weekOk) return "no-match";
  return "match";
}

interface Props {
  value: Desiderata;
  onChange: (d: Desiderata) => void;
}

export default function DesiderataGrid({ value, onChange }: Props) {
  function toggle(key: keyof Desiderata) {
    onChange({ ...value, [key]: !value[key] });
  }

  function toggleSemaine(s: "paire" | "impaire") {
    onChange({ ...value, semaine: value.semaine === s ? null : s });
  }

  return (
    <div className="space-y-2">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left text-gray-400 font-normal pb-1.5 pr-3 w-10" />
            <th className="text-center text-gray-500 font-semibold pb-1.5 px-2">Matin</th>
            <th className="text-center text-gray-500 font-semibold pb-1.5 px-2">Après-midi</th>
          </tr>
        </thead>
        <tbody>
          {JOURS.map((j) => (
            <tr key={j}>
              <td className="text-gray-600 font-medium pr-3 py-0.5">{LABELS[j]}</td>
              <td className="text-center py-0.5 px-2">
                <input
                  type="checkbox"
                  checked={!!value[`${j}_matin` as keyof Desiderata]}
                  onChange={() => toggle(`${j}_matin` as keyof Desiderata)}
                  className="rounded accent-brand-500"
                />
              </td>
              <td className="text-center py-0.5 px-2">
                <input
                  type="checkbox"
                  checked={!!value[`${j}_apm` as keyof Desiderata]}
                  onChange={() => toggle(`${j}_apm` as keyof Desiderata)}
                  className="rounded accent-brand-500"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <span className="text-xs text-gray-500">Semaines :</span>
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.semaine === "paire"}
            onChange={() => toggleSemaine("paire")}
            className="rounded accent-brand-500"
          />
          Paires
        </label>
        <label className="flex items-center gap-1.5 text-xs text-gray-700 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={value.semaine === "impaire"}
            onChange={() => toggleSemaine("impaire")}
            className="rounded accent-brand-500"
          />
          Impaires
        </label>
        {!value.semaine && <span className="text-xs text-gray-400">— toutes</span>}
      </div>
    </div>
  );
}
