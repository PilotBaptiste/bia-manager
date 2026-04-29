"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useYear } from "@/contexts/YearContext";
import { Users, CheckCircle2, Plane, Euro, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";

function Stat({ icon: Icon, label, value, sub, color = "bg-brand-50 text-brand-500" }: any) {
  return (
    <div className="card flex-1 min-w-[170px]">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-9 h-9 rounded-lg ${color.split(" ")[0]} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${color.split(" ")[1]}`} />
        </div>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function DashboardSAStats() {
  const supabase = createClient();
  const { selectedAnneeId, selectedAnnee } = useYear();

  const [stats, setStats] = useState({
    total: 0, attestations: 0, paiements: 0,
    nonPayes: 0, nonSignes: 0,
    vol1Effectues: 0, vol2Effectues: 0, vol2Autorises: 0, volsPrevus: 0,
  });
  const [prochainsCrenaux, setProchainsCrenaux] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedAnneeId) return;
    async function load() {
      setLoading(true);
      function q() {
        const base = supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false);
        return base.eq("annee_id", selectedAnneeId);
      }
      function cq() {
        const base = supabase.from("creneaux").select("*", { count: "exact" }).in("statut", ["ouvert", "confirme"]);
        return base.eq("annee_id", selectedAnneeId);
      }

      const [
        { count: total },
        { count: attestations },
        { count: paiements },
        { count: nonPayes },
        { count: nonSignes },
        { count: vol1Effectues },
        { count: vol2Effectues },
        { count: vol2Autorises },
        { count: volsPrevus },
        { data: prochains },
      ] = await Promise.all([
        q(),
        q().eq("attestation_signee", true),
        q().eq("paiement_effectue", true),
        q().eq("paiement_effectue", false),
        q().eq("attestation_signee", false),
        q().eq("vol1_effectue", true),
        q().eq("vol2_effectue", true),
        q().eq("vol2_autorise", true),
        cq(),
        supabase.from("creneaux")
          .select("*, pilote:profiles!pilote_id(nom, prenom), aeronef:aeronefs(type_aeronef, immatriculation), reservations(id, statut, eleve:eleves(nom, prenom))")
          .in("statut", ["ouvert", "confirme"])
          .eq("annee_id", selectedAnneeId)
          .order("date_vol")
          .limit(5),
      ]);

      setStats({
        total: total || 0, attestations: attestations || 0,
        paiements: paiements || 0, nonPayes: nonPayes || 0,
        nonSignes: nonSignes || 0, vol1Effectues: vol1Effectues || 0,
        vol2Effectues: vol2Effectues || 0, vol2Autorises: vol2Autorises || 0,
        volsPrevus: volsPrevus || 0,
      });
      setProchainsCrenaux(prochains || []);
      setLoading(false);
    }
    load();
  }, [selectedAnneeId]);

  const vol1Restants = stats.total - stats.vol1Effectues;
  const vol2Restants = stats.vol2Autorises - stats.vol2Effectues;

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Tableau de bord — {selectedAnnee?.label ?? "…"}</h1>
          <p className="text-sm text-gray-500 mt-1">Aéro-Club du Bassin d'Arcachon · SuperAdmin</p>
        </div>
        <div className="flex gap-3 flex-wrap mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card flex-1 min-w-[170px] h-20 animate-pulse bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tableau de bord — {selectedAnnee?.label ?? "—"}</h1>
        <p className="text-sm text-gray-500 mt-1">Aéro-Club du Bassin d'Arcachon · SuperAdmin</p>
      </div>
      <div className="flex gap-3 flex-wrap mb-6">
        <Stat icon={Users} label="Élèves inscrits" value={stats.total} color="bg-brand-50 text-brand-500" />
        <Stat icon={CheckCircle2} label="Attestations" value={`${stats.attestations}/${stats.total}`} color="bg-emerald-50 text-emerald-600" />
        <Stat icon={Plane} label="Vol 1 restants" value={`${vol1Restants}/${stats.total}`} sub={`${stats.vol1Effectues} effectué${stats.vol1Effectues > 1 ? "s" : ""}`} color="bg-amber-50 text-amber-600" />
        <Stat icon={Plane} label="Vol 2 restants" value={`${vol2Restants}/${stats.vol2Autorises}`} sub={`${stats.vol2Effectues} effectué${stats.vol2Effectues > 1 ? "s" : ""}`} color="bg-purple-50 text-purple-600" />
        <Stat icon={Calendar} label="Vols prévus" value={stats.volsPrevus} color="bg-brand-50 text-brand-500" />
        <Stat icon={Euro} label="Paiements reçus" value={`${stats.paiements}/${stats.total}`} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Actions requises */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Actions requises</h2>
            {(stats.nonPayes + stats.nonSignes) > 0 && (
              <span className="badge bg-red-50 text-red-600">{stats.nonPayes + stats.nonSignes}</span>
            )}
          </div>
          <div className="space-y-2">
            {stats.nonPayes > 0 && (
              <Link href="/dashboard/eleves?paiement=non" className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-sm hover:bg-red-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-red-700">{stats.nonPayes} élève{stats.nonPayes > 1 ? "s" : ""} — paiement en attente</span>
              </Link>
            )}
            {stats.nonSignes > 0 && (
              <Link href="/dashboard/eleves?attestation=non" className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-sm hover:bg-amber-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-amber-700">{stats.nonSignes} attestation{stats.nonSignes > 1 ? "s" : ""} parentale{stats.nonSignes > 1 ? "s" : ""} non signée{stats.nonSignes > 1 ? "s" : ""}</span>
              </Link>
            )}
            {stats.nonPayes === 0 && stats.nonSignes === 0 && (
              <p className="text-sm text-gray-400">Aucune action requise</p>
            )}
          </div>
        </div>

        {/* Prochains vols */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Prochains vols</h2>
            <Link href="/dashboard/vols" className="text-xs text-brand-500 font-semibold hover:underline">Voir tout →</Link>
          </div>
          {prochainsCrenaux.length > 0 ? (
            <div className="space-y-2">
              {prochainsCrenaux.map((c: any) => {
                const activeRes = (c.reservations || []).filter((r: any) => r.statut !== "annule");
                return (
                  <Link key={c.id} href="/dashboard/vols" className="block p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{new Date(c.date_vol).toLocaleDateString("fr-FR")} · {c.heure_debut?.slice(0, 5)}</p>
                        <p className="text-xs text-gray-500">{c.pilote?.prenom} {c.pilote?.nom} · {c.aeronef?.type_aeronef}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{activeRes.length} élève{activeRes.length > 1 ? "s" : ""}</span>
                        <span className={`badge ${c.statut === "confirme" ? "bg-brand-50 text-brand-500" : "bg-amber-50 text-amber-600"}`}>
                          {c.statut === "confirme" ? "Confirmé" : "Ouvert"}
                        </span>
                      </div>
                    </div>
                    {activeRes.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {activeRes.map((r: any, i: number) => (
                          <span key={i} className="text-[11px] bg-white border border-gray-200 text-gray-700 px-1.5 py-0.5 rounded">
                            {r.eleve?.prenom} {r.eleve?.nom}
                          </span>
                        ))}
                      </div>
                    )}
                    {activeRes.length === 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">Aucun élève inscrit</p>
                    )}
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun vol planifié</p>
          )}
        </div>

        {/* Accès rapide */}
        <div className="card md:col-span-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Accès rapide</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { href: "/dashboard/eleves", label: "Élèves", icon: Users },
              { href: "/dashboard/vols", label: "Planning vols", icon: Calendar },
              { href: "/dashboard/finances", label: "Finances", icon: Euro },
              { href: "/dashboard/archives", label: "Archives", icon: Calendar },
            ].map((l, i) => (
              <Link key={i} href={l.href} className="flex items-center gap-2 p-3 rounded-lg hover:bg-gray-50 border border-gray-100 text-sm text-gray-700 transition-colors">
                <l.icon className="w-4 h-4 text-brand-400" />{l.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
