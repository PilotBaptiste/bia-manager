"use client";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Loader2, CheckCircle2, Download, Users } from "lucide-react";
import { fetchAll } from "@/lib/fetchAll";
import { useYear } from "@/contexts/YearContext";

const supabase = createClient();

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Qui a ouvert ce cours, élève par élève, pour l'équipe du club. */
export default function SuiviCours({
  cours,
  onFermer,
}: {
  cours: { id: string; titre: string; ressources: { id: string }[] };
  onFermer: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [eleves, setEleves] = useState<any[]>([]);
  const [vus, setVus] = useState<any[]>([]);
  const [vuesRessources, setVuesRessources] = useState<any[]>([]);
  const [filtre, setFiltre] = useState<"tous" | "commence" | "termine" | "jamais">("tous");
  // Le suivi porte sur l'année choisie dans le menu : sans ce filtre, les élèves de
  // 2026 et de 2027 se mélangent et « jamais ouvert » compte des élèves d'une autre année.
  const { selectedAnneeId, annees } = useYear();
  const anneeLabel = annees.find((a: any) => a.id === selectedAnneeId)?.label ?? "";

  useEffect(() => {
    async function load() {
      setLoading(true);
      const ressourceIds = cours.ressources.map((r) => r.id);
      const [elevesR, vusR, vrR] = await Promise.all([
        fetchAll((from, to) => {
          const q = supabase
            .from("eleves")
            .select("id, nom, prenom, archive, abandonne, etablissement:etablissements(nom)")
            .eq("archive", false);
          return (selectedAnneeId ? q.eq("annee_id", selectedAnneeId) : q)
            .order("nom")
            .order("id")
            .range(from, to);
        }),
        supabase.from("cours_vus").select("eleve_id, vu_at, termine_at").eq("cours_id", cours.id),
        ressourceIds.length > 0
          ? supabase.from("cours_ressources_vues").select("ressource_id, eleve_id").in("ressource_id", ressourceIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      setEleves((elevesR.data ?? []).filter((e: any) => !e.abandonne));
      setVus(vusR.data ?? []);
      setVuesRessources(vrR.data ?? []);
      setLoading(false);
    }
    load();
  }, [cours.id, cours.ressources, selectedAnneeId]);

  const lignes = useMemo(() => {
    const total = cours.ressources.length;
    const parEleve = new Map<string, { ouverts: number }>();
    for (const v of vuesRessources) {
      if (!v.eleve_id) continue;
      const e = parEleve.get(v.eleve_id) ?? { ouverts: 0 };
      e.ouverts += 1;
      parEleve.set(v.eleve_id, e);
    }
    const suivi = new Map(vus.filter((v) => v.eleve_id).map((v) => [v.eleve_id, v]));

    return eleves.map((e) => {
      const v = suivi.get(e.id);
      return {
        ...e,
        ouverts: parEleve.get(e.id)?.ouverts ?? 0,
        total,
        vu_at: v?.vu_at ?? null,
        termine_at: v?.termine_at ?? null,
      };
    });
  }, [eleves, vus, vuesRessources, cours.ressources]);

  const visibles = useMemo(
    () =>
      lignes.filter((l) => {
        if (filtre === "termine") return !!l.termine_at;
        if (filtre === "commence") return !l.termine_at && (l.ouverts > 0 || l.vu_at);
        if (filtre === "jamais") return !l.termine_at && l.ouverts === 0 && !l.vu_at;
        return true;
      }),
    [lignes, filtre],
  );

  const stats = useMemo(
    () => ({
      termines: lignes.filter((l) => l.termine_at).length,
      commences: lignes.filter((l) => !l.termine_at && (l.ouverts > 0 || l.vu_at)).length,
      jamais: lignes.filter((l) => !l.termine_at && l.ouverts === 0 && !l.vu_at).length,
    }),
    [lignes],
  );

  function exporter() {
    const entetes = ["Eleve", "Etablissement", "Documents ouverts", "Total documents", "Premiere ouverture", "Termine le"];
    const csv = [
      entetes.join(";"),
      ...lignes.map((l) =>
        [l.prenom + " " + l.nom, l.etablissement?.nom ?? "", l.ouverts, l.total, fmt(l.vu_at), fmt(l.termine_at)]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `suivi-cours-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl w-full max-w-2xl my-8">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-gray-100">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Suivi de lecture{anneeLabel ? ` · ${anneeLabel}` : ""}
            </p>
            <h2 className="font-bold text-gray-900 text-lg truncate">{cours.titre}</h2>
          </div>
          <button onClick={onFermer} className="text-gray-400 hover:text-gray-600 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 mb-4">
                {([
                  ["termine", "Terminé", stats.termines, "text-emerald-600"],
                  ["commence", "Commencé", stats.commences, "text-amber-600"],
                  ["jamais", "Jamais ouvert", stats.jamais, "text-gray-400"],
                ] as const).map(([key, label, valeur, couleur]) => (
                  <button
                    key={key}
                    onClick={() => setFiltre(filtre === key ? "tous" : key)}
                    className={`rounded-lg border p-2.5 text-left transition-colors ${filtre === key ? "border-brand-300 bg-brand-50" : "border-gray-200 hover:bg-gray-50"}`}
                  >
                    <p className={`text-xl font-bold ${couleur}`}>{valeur}</p>
                    <p className="text-[11px] text-gray-500">{label}</p>
                  </button>
                ))}
              </div>

              {lignes.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">Aucun élève actif à suivre.</p>
                </div>
              ) : (
                <div className="border border-gray-200 rounded-lg overflow-auto max-h-[45vh]">
                  <table className="w-full text-sm min-w-[520px]">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        {["Élève", "Établissement", "Documents", "Terminé le"].map((h) => (
                          <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold uppercase text-gray-400">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visibles.map((l) => (
                        <tr key={l.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">{l.prenom} {l.nom}</td>
                          <td className="px-3 py-2 text-gray-500 text-xs">{l.etablissement?.nom ?? "—"}</td>
                          <td className="px-3 py-2 text-xs">
                            <span className={l.ouverts > 0 ? "font-semibold text-gray-800" : "text-gray-400"}>
                              {l.ouverts} / {l.total}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {l.termine_at ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" /> {fmt(l.termine_at)}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {visibles.length === 0 && (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-400 text-sm">Aucun élève dans cette catégorie.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between gap-2 mt-4 flex-wrap">
                <p className="text-[11px] text-gray-400">
                  Les consultations sont enregistrées par élève : les deux parents d&apos;un même élève alimentent la même progression.
                </p>
                {lignes.length > 0 && (
                  <button onClick={exporter} className="btn-secondary btn-sm">
                    <Download className="w-3.5 h-3.5" /> Export CSV
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
