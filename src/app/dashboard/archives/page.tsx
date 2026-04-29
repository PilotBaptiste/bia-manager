"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useYear } from "@/contexts/YearContext";
import {
  Archive,
  Users,
  Plane,
  CheckCircle2,
  Search,
  Loader2,
  CalendarDays,
  School,
  Euro,
  Clock,
  TrendingUp,
  FileSignature,
} from "lucide-react";

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-4 items-start shadow-sm">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─── Badge ───────────────────────────────────────────────────────────────────
function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${color}`}>
      {children}
    </span>
  );
}

export default function ArchivesPage() {
  const supabase = createClient();
  // Archives utilise le même sélecteur global que les autres pages
  const { annees, selectedAnneeId, selectedAnnee, activeAnneeId, loading: yearLoading } = useYear();

  const [eleves, setEleves] = useState<any[]>([]);
  const [creneaux, setCreneaux] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [tab, setTab] = useState<"eleves" | "vols">("eleves");
  const [search, setSearch] = useState("");

  // ── Load eleves + creneaux when year changes ───────────────────────────────
  useEffect(() => {
    if (!selectedAnneeId) return;
    async function loadData() {
      setLoadingData(true);
      const [eR, cR] = await Promise.all([
        supabase
          .from("eleves")
          .select(
            `id, nom, prenom, parent_email, parent_telephone, abandonne,
             vol1_effectue, vol2_effectue, attestation_signee, paiement_effectue,
             etablissement:etablissements(nom),
             vol1_aeronef:aeronefs!vol1_aeronef_id(type_aeronef, immatriculation),
             vol2_aeronef:aeronefs!vol2_aeronef_id(type_aeronef, immatriculation)`
          )
          .eq("annee_id", selectedAnneeId)
          .order("nom"),
        supabase
          .from("creneaux")
          .select(
            `id, date_vol, heure_debut, heure_fin, statut,
             etablissement:etablissements(nom),
             pilote:profiles!pilote_id(nom, prenom),
             aeronef:aeronefs(type_aeronef, immatriculation, prix_heure),
             reservations(
               id, statut, type_vol,
               eleve:eleves(nom, prenom)
             )`
          )
          .eq("annee_id", selectedAnneeId)
          .order("date_vol"),
      ]);
      setEleves(eR.data || []);
      setCreneaux(cR.data || []);
      setLoadingData(false);
    }
    loadData();
  }, [selectedAnneeId]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const actifs = eleves.filter((e) => !e.abandonne);
    const vol1 = eleves.filter((e) => e.vol1_effectue).length;
    const vol2 = eleves.filter((e) => e.vol2_effectue).length;
    const attests = eleves.filter((e) => e.attestation_signee).length;
    const payes = eleves.filter((e) => e.paiement_effectue).length;

    const termines = creneaux.filter((c) => c.statut === "termine").length;
    const totalCreneaux = creneaux.length;

    // CA vols: sum of (prix_heure * duree) for completed slots
    const caVols = creneaux
      .filter((c) => c.statut === "termine")
      .reduce((sum: number, c: any) => {
        const prix = c.aeronef?.prix_heure ?? 0;
        if (!c.heure_debut || !c.heure_fin) return sum;
        const [h1, m1] = c.heure_debut.split(":").map(Number);
        const [h2, m2] = c.heure_fin.split(":").map(Number);
        const dureeH = (h2 * 60 + m2 - (h1 * 60 + m1)) / 60;
        return sum + prix * dureeH;
      }, 0);

    return { totalEleves: eleves.length, actifs: actifs.length, vol1, vol2, attests, payes, termines, totalCreneaux, caVols };
  }, [eleves, creneaux]);

  // ── Filtered lists ────────────────────────────────────────────────────────
  const filteredEleves = useMemo(() => {
    if (!search.trim()) return eleves;
    const q = search.toLowerCase();
    return eleves.filter(
      (e) =>
        e.nom?.toLowerCase().includes(q) ||
        e.prenom?.toLowerCase().includes(q) ||
        e.parent_email?.toLowerCase().includes(q) ||
        e.etablissement?.nom?.toLowerCase().includes(q)
    );
  }, [eleves, search]);

  const filteredCreneaux = useMemo(() => {
    if (!search.trim()) return creneaux;
    const q = search.toLowerCase();
    return creneaux.filter(
      (c) =>
        c.etablissement?.nom?.toLowerCase().includes(q) ||
        c.pilote?.nom?.toLowerCase().includes(q) ||
        c.pilote?.prenom?.toLowerCase().includes(q) ||
        c.aeronef?.immatriculation?.toLowerCase().includes(q) ||
        c.date_vol?.includes(q)
    );
  }, [creneaux, search]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (yearLoading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (annees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[50vh] gap-3">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <Archive className="w-6 h-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900">Aucune année scolaire</h2>
        <p className="text-sm text-gray-500 text-center max-w-xs">
          Créez des années scolaires dans{" "}
          <strong>Paramètres → Années scolaires</strong> pour accéder aux archives.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center">
          <Archive className="w-5 h-5 text-brand-500" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Archives — {selectedAnnee?.label ?? "—"}</h1>
          <p className="text-sm text-gray-500">Consultez l'année scolaire depuis le sélecteur dans la sidebar</p>
        </div>
      </div>

      {/* ── Active badge ── */}
      {selectedAnnee?.active && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>
            <strong>Année en cours</strong> — les données ci-dessous sont actives et peuvent encore évoluer.
          </span>
        </div>
      )}

      {/* ── Year info ── */}
      {selectedAnnee && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <CalendarDays className="w-4 h-4" />
          <span>
            {new Date(selectedAnnee.date_debut).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            {" → "}
            {new Date(selectedAnnee.date_fin).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
      )}

      {loadingData ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
        </div>
      ) : (
        <>
          {/* ── Stats grid ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              icon={Users}
              label="Élèves inscrits"
              value={stats.totalEleves}
              sub={`${stats.actifs} actifs`}
              color="bg-blue-50 text-blue-600"
            />
            <StatCard
              icon={Plane}
              label="Vol 1 effectué"
              value={stats.vol1}
              sub={`sur ${stats.totalEleves} élèves`}
              color="bg-sky-50 text-sky-600"
            />
            <StatCard
              icon={Plane}
              label="Vol 2 effectué"
              value={stats.vol2}
              sub={`sur ${stats.totalEleves} élèves`}
              color="bg-indigo-50 text-indigo-600"
            />
            <StatCard
              icon={FileSignature}
              label="Attestations"
              value={stats.attests}
              sub="signées"
              color="bg-violet-50 text-violet-600"
            />
            <StatCard
              icon={Euro}
              label="Paiements reçus"
              value={stats.payes}
              sub={`sur ${stats.totalEleves} élèves`}
              color="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              icon={Clock}
              label="Créneaux planifiés"
              value={stats.totalCreneaux}
              sub={`${stats.termines} terminés`}
              color="bg-amber-50 text-amber-600"
            />
            <StatCard
              icon={CheckCircle2}
              label="Vols terminés"
              value={stats.termines}
              sub="créneaux"
              color="bg-green-50 text-green-600"
            />
            <StatCard
              icon={TrendingUp}
              label="CA vols estimé"
              value={`${stats.caVols.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`}
              sub="vols terminés"
              color="bg-rose-50 text-rose-600"
            />
          </div>

          {/* ── Tabs + search ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
              {(["eleves", "vols"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSearch(""); }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    tab === t
                      ? "bg-white text-brand-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {t === "eleves" ? `Élèves (${eleves.length})` : `Vols (${creneaux.length})`}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 w-56"
              />
            </div>
          </div>

          {/* ── Élèves table ── */}
          {tab === "eleves" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Élève</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Établissement</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Paiement</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Vol 1</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Vol 2</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Attestation</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredEleves.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                          {search ? "Aucun résultat" : "Aucun élève pour cette année"}
                        </td>
                      </tr>
                    ) : (
                      filteredEleves.map((e) => (
                        <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900">
                              {e.prenom} {e.nom}
                            </div>
                            {e.parent_email && (
                              <div className="text-xs text-gray-400 mt-0.5">{e.parent_email}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-gray-600">
                              <School className="w-3.5 h-3.5 text-gray-400" />
                              {e.etablissement?.nom || "—"}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.paiement_effectue ? (
                              <Badge color="bg-emerald-100 text-emerald-700">✓ Reçu</Badge>
                            ) : (
                              <Badge color="bg-gray-100 text-gray-500">En attente</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.vol1_effectue ? (
                              <Badge color="bg-sky-100 text-sky-700">✓ Fait</Badge>
                            ) : (
                              <Badge color="bg-gray-100 text-gray-400">—</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.vol2_effectue ? (
                              <Badge color="bg-indigo-100 text-indigo-700">✓ Fait</Badge>
                            ) : (
                              <Badge color="bg-gray-100 text-gray-400">—</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.attestation_signee ? (
                              <Badge color="bg-violet-100 text-violet-700">✓ Signée</Badge>
                            ) : (
                              <Badge color="bg-gray-100 text-gray-400">—</Badge>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {e.abandonne ? (
                              <Badge color="bg-red-100 text-red-600">Abandonné</Badge>
                            ) : (
                              <Badge color="bg-green-100 text-green-700">Actif</Badge>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Vols table ── */}
          {tab === "vols" && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Horaire</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Établissement</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Pilote</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Appareil</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Élèves</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider">Statut</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredCreneaux.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-gray-400 text-sm">
                          {search ? "Aucun résultat" : "Aucun créneau pour cette année"}
                        </td>
                      </tr>
                    ) : (
                      filteredCreneaux.map((c) => {
                        const activeResas = (c.reservations || []).filter(
                          (r: any) => r.statut !== "annule"
                        );
                        const statutColor =
                          c.statut === "termine"
                            ? "bg-green-100 text-green-700"
                            : c.statut === "confirme"
                            ? "bg-blue-100 text-blue-700"
                            : c.statut === "annule"
                            ? "bg-red-100 text-red-600"
                            : "bg-amber-100 text-amber-700";
                        return (
                          <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">
                              {c.date_vol
                                ? new Date(c.date_vol).toLocaleDateString("fr-FR", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-3 text-gray-500">
                              {c.heure_debut && c.heure_fin
                                ? `${c.heure_debut} – ${c.heure_fin}`
                                : c.heure_debut || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5 text-gray-600">
                                <School className="w-3.5 h-3.5 text-gray-400" />
                                {c.etablissement?.nom || "—"}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {c.pilote
                                ? `${c.pilote.prenom} ${c.pilote.nom}`
                                : "—"}
                            </td>
                            <td className="px-4 py-3">
                              {c.aeronef ? (
                                <span className="text-gray-700">
                                  {c.aeronef.type_aeronef}{" "}
                                  <span className="text-gray-400 text-xs">
                                    {c.aeronef.immatriculation}
                                  </span>
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="text-gray-700 font-semibold">
                                {activeResas.length}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <Badge color={statutColor}>
                                {c.statut === "termine"
                                  ? "Terminé"
                                  : c.statut === "confirme"
                                  ? "Confirmé"
                                  : c.statut === "annule"
                                  ? "Annulé"
                                  : c.statut === "planifie"
                                  ? "Planifié"
                                  : c.statut || "—"}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
