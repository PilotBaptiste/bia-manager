import { getCurrentProfile } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Users, CheckCircle2, Plane, Euro, Calendar, Clock, School, FileSignature, CalendarPlus, AlertCircle } from "lucide-react";
import Link from "next/link";
import ParentOnboarding from "@/components/ParentOnboarding";

// ─── Stat Card ──────────────────────────────────────────
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

// ─── SuperAdmin Dashboard ───────────────────────────────
async function DashboardSuperAdmin({ supabase }: { supabase: any }) {
  const [
    { count: totalEleves },
    { count: attestations },
    { count: paiements },
    { count: nonPayes },
    { count: nonSignes },
    { count: vol1Effectues },
    { count: vol2Effectues },
    { count: vol2Autorises },
    { count: volsPrevus },
    { data: prochainsCrenaux },
  ] = await Promise.all([
    supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("attestation_signee", true).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("paiement_effectue", true).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("paiement_effectue", false).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("attestation_signee", false).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("vol1_effectue", true).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("vol2_effectue", true).eq("archive", false),
    supabase.from("eleves").select("*", { count: "exact" }).eq("vol2_autorise", true).eq("archive", false),
    supabase.from("creneaux").select("*", { count: "exact" }).in("statut", ["ouvert", "confirme"]),
    supabase.from("creneaux")
      .select("*, pilote:profiles!pilote_id(nom, prenom), aeronef:aeronefs(type_aeronef, immatriculation), reservations(id, statut, eleve:eleves(nom, prenom))")
      .in("statut", ["ouvert", "confirme"])
      .order("date_vol")
      .limit(5),
  ]);

  const total = totalEleves || 0;
  const vol1Restants = total - (vol1Effectues || 0);
  const vol2Total = vol2Autorises || 0;
  const vol2Restants = vol2Total - (vol2Effectues || 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tableau de bord — {new Date().getFullYear()}</h1>
        <p className="text-sm text-gray-500 mt-1">Aéro-Club du Bassin d&apos;Arcachon · SuperAdmin</p>
      </div>
      <div className="flex gap-3 flex-wrap mb-6">
        <Stat icon={Users} label="Élèves inscrits" value={total} color="bg-brand-50 text-brand-500" />
        <Stat icon={CheckCircle2} label="Attestations" value={`${attestations || 0}/${total}`} color="bg-emerald-50 text-emerald-600" />
        <Stat icon={Plane} label="Vol 1 restants" value={`${vol1Restants}/${total}`} sub={`${vol1Effectues || 0} effectué${(vol1Effectues || 0) > 1 ? "s" : ""}`} color="bg-amber-50 text-amber-600" />
        <Stat icon={Plane} label="Vol 2 restants" value={`${vol2Restants}/${vol2Total}`} sub={`${vol2Effectues || 0} effectué${(vol2Effectues || 0) > 1 ? "s" : ""}`} color="bg-purple-50 text-purple-600" />
        <Stat icon={Calendar} label="Vols prévus" value={volsPrevus || 0} color="bg-brand-50 text-brand-500" />
        <Stat icon={Euro} label="Paiements reçus" value={`${paiements || 0}/${total}`} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Actions requises */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Actions requises</h2>
            {((nonPayes || 0) + (nonSignes || 0)) > 0 && (
              <span className="badge bg-red-50 text-red-600">{(nonPayes || 0) + (nonSignes || 0)}</span>
            )}
          </div>
          <div className="space-y-2">
            {(nonPayes || 0) > 0 && (
              <Link href="/dashboard/eleves?paiement=non" className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 text-sm hover:bg-red-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-red-700">{nonPayes} élève{(nonPayes || 0) > 1 ? "s" : ""} — paiement en attente</span>
              </Link>
            )}
            {(nonSignes || 0) > 0 && (
              <Link href="/dashboard/eleves?attestation=non" className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 text-sm hover:bg-amber-100 transition-colors">
                <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-amber-700">{nonSignes} attestation{(nonSignes || 0) > 1 ? "s" : ""} parentale{(nonSignes || 0) > 1 ? "s" : ""} non signée{(nonSignes || 0) > 1 ? "s" : ""}</span>
              </Link>
            )}
            {(nonPayes || 0) === 0 && (nonSignes || 0) === 0 && (
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
          {prochainsCrenaux && prochainsCrenaux.length > 0 ? (
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
              { href: "/dashboard/etablissements", label: "Établissements", icon: School },
              { href: "/dashboard/vols", label: "Planning vols", icon: Calendar },
              { href: "/dashboard/finances", label: "Finances", icon: Euro },
              { href: "/dashboard/aeronefs", label: "Aéronefs", icon: Plane },
              { href: "/dashboard/utilisateurs", label: "Utilisateurs", icon: Users },
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

// ─── Coordinateur Dashboard ─────────────────────────────
async function DashboardCoordinateur({ supabase, profile }: { supabase: any; profile: any }) {
  const coordEtabIds: string[] = profile?.etablissement_ids?.length > 0
    ? profile.etablissement_ids
    : profile?.etablissement_id ? [profile.etablissement_id] : [];

  // Base query builders filtered by coord's établissements (or all if no restriction)
  const eleveBase = coordEtabIds.length > 0
    ? supabase.from("eleves").select("*", { count: "exact" }).in("etablissement_id", coordEtabIds).eq("archive", false)
    : supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false);

  const [
    { count: totalEleves },
    { count: vol1Effectues },
    { count: vol2Effectues },
    { count: vol2Autorises },
    { data: etabs },
    { data: prochainsCrenaux },
  ] = await Promise.all([
    eleveBase,
    (coordEtabIds.length > 0
      ? supabase.from("eleves").select("*", { count: "exact" }).in("etablissement_id", coordEtabIds).eq("archive", false).eq("vol1_effectue", true)
      : supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false).eq("vol1_effectue", true)),
    (coordEtabIds.length > 0
      ? supabase.from("eleves").select("*", { count: "exact" }).in("etablissement_id", coordEtabIds).eq("archive", false).eq("vol2_effectue", true)
      : supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false).eq("vol2_effectue", true)),
    (coordEtabIds.length > 0
      ? supabase.from("eleves").select("*", { count: "exact" }).in("etablissement_id", coordEtabIds).eq("archive", false).eq("vol2_autorise", true)
      : supabase.from("eleves").select("*", { count: "exact" }).eq("archive", false).eq("vol2_autorise", true)),
    supabase.from("etablissements").select("id, nom").eq("actif", true)
      .then((r: any) => coordEtabIds.length > 0 ? { data: (r.data || []).filter((e: any) => coordEtabIds.includes(e.id)) } : r),
    supabase.from("creneaux")
      .select("*, pilote:profiles!pilote_id(nom, prenom), aeronef:aeronefs(type_aeronef, immatriculation), reservations(id, statut, eleve:eleves(nom, prenom))")
      .in("statut", ["ouvert", "confirme"])
      .order("date_vol")
      .limit(5),
  ]);

  const total = totalEleves || 0;
  const vol1Restants = total - (vol1Effectues || 0);
  const vol2Total = vol2Autorises || 0;
  const vol2Restants = vol2Total - (vol2Effectues || 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Tableau de bord — Coordinateur</h1>
        <p className="text-sm text-gray-500 mt-1">{coordEtabIds.length > 0 ? `${(etabs || []).length} établissement${(etabs || []).length > 1 ? "s" : ""}` : "Vue globale"} · {new Date().getFullYear()}</p>
      </div>
      <div className="flex gap-3 flex-wrap mb-6">
        <Stat icon={Users} label="Élèves" value={total} />
        <Stat icon={Plane} label="Vol 1 restants" value={`${vol1Restants}/${total}`} sub={`${vol1Effectues || 0} effectué${(vol1Effectues || 0) > 1 ? "s" : ""}`} color="bg-amber-50 text-amber-600" />
        <Stat icon={Plane} label="Vol 2 restants" value={`${vol2Restants}/${vol2Total}`} sub={`${vol2Effectues || 0} effectué${(vol2Effectues || 0) > 1 ? "s" : ""}`} color="bg-purple-50 text-purple-600" />
        <Stat icon={School} label="Établissements" value={(etabs || []).length} color="bg-emerald-50 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Par établissement</h2>
          {etabs && etabs.length > 0 ? (
            <div className="space-y-2">
              {etabs.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <p className="text-sm font-medium text-gray-900">{e.nom}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Aucun établissement</p>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Prochains vols</h2>
            <Link href="/dashboard/vols" className="text-xs text-brand-500 font-semibold hover:underline">Voir tout →</Link>
          </div>
          {prochainsCrenaux && prochainsCrenaux.length > 0 ? (
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
                      <span className="text-xs text-gray-500">{activeRes.length} élève{activeRes.length > 1 ? "s" : ""}</span>
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
      </div>
    </div>
  );
}

// ─── Pilote Dashboard ───────────────────────────────────
async function DashboardPilote({ supabase, profile }: { supabase: any; profile: any }) {
  const { data: mesCreneaux } = await supabase.from("creneaux").select("*, aeronef:aeronefs(type_aeronef, immatriculation), reservations(*, eleve:eleves(nom, prenom, commentaires, vol1_temps_minutes))").eq("pilote_id", profile.id).order("date_vol");
  const aVenir = mesCreneaux?.filter((c: any) => c.statut !== "termine" && c.statut !== "annule") || [];
  const termines = mesCreneaux?.filter((c: any) => c.statut === "termine") || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Mon espace pilote</h1>
        <p className="text-sm text-gray-500 mt-1">{profile.prenom} {profile.nom}</p>
      </div>
      <div className="flex gap-3 flex-wrap mb-6">
        <Stat icon={Calendar} label="Créneaux à venir" value={aVenir.length} color="bg-amber-50 text-amber-600" />
        <Stat icon={Plane} label="Vols terminés" value={termines.length} color="bg-emerald-50 text-emerald-600" />
        <Stat icon={Clock} label="Élèves emmenés" value={termines.reduce((acc: number, c: any) => acc + (c.reservations?.filter((r: any) => r.statut !== "annule").length || 0), 0)} color="bg-brand-50 text-brand-500" />
      </div>

      <div className="card mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Mes prochains créneaux</h2>
          <Link href="/dashboard/vols" className="text-xs text-brand-500 font-semibold hover:underline">Voir tout →</Link>
        </div>
        {aVenir.length > 0 ? (
          <div className="space-y-2">
            {aVenir.map((c: any) => (
              <div key={c.id} className="p-3 rounded-lg bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{new Date(c.date_vol).toLocaleDateString("fr-FR")} · {c.heure_debut?.slice(0, 5)} - {c.heure_fin?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-500">{c.aeronef?.type_aeronef} ({c.aeronef?.immatriculation})</p>
                  </div>
                  <span className={`badge ${c.statut === "confirme" ? "bg-brand-50 text-brand-500" : "bg-amber-50 text-amber-600"}`}>
                    {c.statut === "confirme" ? "Confirmé" : "Ouvert"}
                  </span>
                </div>
                {c.reservations?.filter((r: any) => r.statut !== "annule").length > 0 && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-100 text-xs">
                    <p className="font-semibold text-gray-700 mb-1">Élèves inscrits :</p>
                    {c.reservations.filter((r: any) => r.statut !== "annule").map((r: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 py-0.5">
                        <span className="text-gray-900">{r.eleve?.prenom} {r.eleve?.nom}</span>
                        {r.eleve?.vol1_temps_minutes && <span className="text-gray-400">(Vol 1: {r.eleve.vol1_temps_minutes}min)</span>}
                        {r.eleve?.commentaires && <span className="text-amber-600">⚠ {r.eleve.commentaires}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun créneau à venir. <Link href="/dashboard/vols" className="text-brand-500 underline">Créer un créneau</Link></p>
        )}
      </div>
    </div>
  );
}

// ─── Gérant Dashboard ───────────────────────────────────
async function DashboardGerant({ supabase, profile }: { supabase: any; profile: any }) {
  const etabId = profile.etablissement_id;

  // Guard: gérant without établissement assigned
  if (!etabId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Aucun établissement assigné</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Votre compte gérant n&apos;est pas encore lié à un établissement.<br />
          Contactez le SuperAdmin pour qu&apos;il vous assigne un établissement.
        </p>
      </div>
    );
  }

  const { data: etab } = await supabase.from("etablissements").select("nom").eq("id", etabId).single();
  const { data: mesEleves } = await supabase.from("eleves").select("*").eq("etablissement_id", etabId).eq("archive", false).order("nom");
  const eleves = mesEleves || [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">{etab?.nom || "Mon établissement"}</h1>
        <p className="text-sm text-gray-500 mt-1">Espace gérant · {eleves.length} élève{eleves.length > 1 ? "s" : ""}</p>
      </div>
      {(() => {
        const vol1Eff = eleves.filter((e: any) => e.vol1_effectue).length;
        const vol2Aut = eleves.filter((e: any) => e.vol2_autorise).length;
        const vol2Eff = eleves.filter((e: any) => e.vol2_effectue).length;
        return (
          <div className="flex gap-3 flex-wrap mb-6">
            <Stat icon={Users} label="Mes élèves" value={eleves.length} />
            <Stat icon={Plane} label="Vol 1 restants" value={`${eleves.length - vol1Eff}/${eleves.length}`} sub={`${vol1Eff} effectué${vol1Eff > 1 ? "s" : ""}`} color="bg-amber-50 text-amber-600" />
            <Stat icon={Plane} label="Vol 2 restants" value={`${vol2Aut - vol2Eff}/${vol2Aut}`} sub={`${vol2Eff} effectué${vol2Eff > 1 ? "s" : ""}`} color="bg-purple-50 text-purple-600" />
            <Stat icon={Euro} label="Paiements" value={`${eleves.filter((e: any) => e.paiement_effectue).length}/${eleves.length}`} color="bg-emerald-50 text-emerald-600" />
          </div>
        );
      })()}

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Mes élèves</h2>
          <Link href="/dashboard/eleves" className="text-xs text-brand-500 font-semibold hover:underline">Gérer →</Link>
        </div>
        {eleves.length > 0 ? (
          <div className="space-y-2">
            {eleves.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.prenom} {s.nom}</p>
                  <p className="text-xs text-gray-500">{s.classe}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className={s.paiement_effectue ? "dot-success" : "dot-danger"} /> Paie.</span>
                  <span className="flex items-center gap-1"><span className={s.attestation_signee ? "dot-success" : "dot-danger"} /> Att.</span>
                  <span className="flex items-center gap-1"><span className={s.vol1_effectue ? "dot-success" : "dot-danger"} /> Vol</span>
                  {s.bia_resultat && <span className="badge bg-emerald-50 text-emerald-600">{s.bia_resultat}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Aucun élève inscrit. <Link href="/dashboard/eleves" className="text-brand-500 underline">Inscrire un élève</Link></p>
        )}
      </div>
    </div>
  );
}

// ─── Parent Dashboard ───────────────────────────────────
async function DashboardParent({ supabase, profile }: { supabase: any; profile: any }) {
  const [{ data: mesEnfants }, { data: paramsData }] = await Promise.all([
    supabase.from("eleves").select("*, etablissement:etablissements(nom), reservations(*, creneau:creneaux(date_vol, heure_debut, heure_fin, statut, pilote:profiles!pilote_id(nom, prenom, email, telephone), aeronef:aeronefs(type_aeronef, immatriculation)))").eq("parent_id", profile.id).eq("archive", false),
    supabase.from("parametres").select("cle, valeur"),
  ]);
  const enfants = mesEnfants || [];
  const params = Object.fromEntries((paramsData || []).map((p: any) => [p.cle, p.valeur]));
  const contactNom = params["nom_aeroclub"] || "Aéro-Club du Bassin d'Arcachon";
  const contactEmail = params["email_aeroclub"] || "contact@acba.fr";
  const contactTel = params["telephone_aeroclub"] || null;

  // Show onboarding modal if profile incomplete
  // Check nom + prenom + telephone — ensures parents who had their account deleted+recreated
  // (and kept their old profile row) still go through onboarding if telephone is missing
  const needsOnboarding = !profile.nom || !profile.prenom || !profile.telephone;

  return (
    <div>
      {needsOnboarding && (
        <ParentOnboarding
          userId={profile.id}
          defaultPrenom={profile.prenom || ""}
          defaultNom={profile.nom || ""}
          defaultTelephone={profile.telephone || ""}
        />
      )}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Bonjour{profile.prenom ? `, ${profile.prenom}` : ""} !</h1>
        <p className="text-sm text-gray-500 mt-1">Espace parent · Aéro-Club du Bassin d&apos;Arcachon</p>
      </div>

      {enfants.length > 0 ? (
        enfants.map((e: any) => {
          const activeRes = (e.reservations || []).filter((r: any) => r.statut !== "annule");
          const vol1Res = activeRes.find((r: any) => r.type_vol === 1 && r.statut !== "annule");
          const vol2Res = activeRes.find((r: any) => r.type_vol === 2 && r.statut !== "annule");
          return (
          <div key={e.id} className="card mb-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <div>
                <p className="text-lg font-bold text-gray-900">{e.prenom} {e.nom}</p>
                <p className="text-sm text-gray-500">{e.etablissement?.nom} · {e.classe}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {/* Paiement */}
              <div className={`p-3 rounded-lg ${e.paiement_effectue ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="text-xs font-semibold text-gray-500 mb-1">Paiement inscription</p>
                {e.paiement_effectue ? (
                  <p className="text-sm font-semibold text-emerald-700">✅ Paye — {e.paiement_montant || 80}€</p>
                ) : (
                  <p className="text-sm font-semibold text-red-700">❌ En attente — {e.paiement_montant || 80}€</p>
                )}
              </div>

              {/* Attestation */}
              <div className={`p-3 rounded-lg ${e.attestation_signee ? "bg-emerald-50" : "bg-red-50"}`}>
                <p className="text-xs font-semibold text-gray-500 mb-1">Attestation parentale</p>
                {e.attestation_signee ? (
                  <p className="text-sm font-semibold text-emerald-700">✅ Signee</p>
                ) : (
                  <div><p className="text-sm font-semibold text-red-700 mb-1">❌ A signer</p><Link href="/dashboard/attestation" className="text-xs text-brand-500 font-semibold hover:underline">Signer maintenant →</Link></div>
                )}
              </div>

              {/* Vol 1 */}
              <div className={`p-3 rounded-lg ${e.vol1_effectue ? "bg-emerald-50" : vol1Res ? "bg-brand-50" : "bg-gray-50"}`}>
                <p className="text-xs font-semibold text-gray-500 mb-1">Vol decouverte n°1</p>
                {e.vol1_effectue ? (
                  <p className="text-sm font-semibold text-emerald-700">✅ Effectue ({e.vol1_temps_minutes} min)</p>
                ) : vol1Res ? (
                  <div>
                    <p className="text-sm font-semibold text-brand-600 mb-1">📅 Reserve</p>
                    <p className="text-xs text-gray-600">{new Date(vol1Res.creneau?.date_vol).toLocaleDateString("fr-FR")} · {vol1Res.creneau?.heure_debut?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-500">{vol1Res.creneau?.pilote?.prenom} {vol1Res.creneau?.pilote?.nom} · {vol1Res.creneau?.aeronef?.type_aeronef}</p>
                    {vol1Res.creneau?.pilote?.telephone && <p className="text-xs text-gray-400 mt-1">Tel: {vol1Res.creneau.pilote.telephone}</p>}
                  </div>
                ) : e.paiement_effectue && e.attestation_signee ? (
                  <div><p className="text-sm font-semibold text-amber-600 mb-1">🟡 Peut reserver</p><Link href="/dashboard/reservation" className="text-xs text-brand-500 font-semibold hover:underline">Reserver un creneau →</Link></div>
                ) : (
                  <p className="text-sm text-gray-500">⏳ Paiement et attestation requis</p>
                )}
              </div>

              {/* BIA / Vol 2 */}
              <div className={`p-3 rounded-lg ${e.vol2_effectue ? "bg-emerald-50" : vol2Res ? "bg-brand-50" : e.bia_resultat ? "bg-emerald-50" : "bg-gray-50"}`}>
                <p className="text-xs font-semibold text-gray-500 mb-1">BIA / Vol n°2</p>
                {e.vol2_effectue ? (
                  <p className="text-sm font-semibold text-emerald-700">✅ Vol 2 effectue</p>
                ) : vol2Res ? (
                  <div>
                    <p className="text-sm font-semibold text-brand-600 mb-1">📅 Vol 2 reserve</p>
                    <p className="text-xs text-gray-600">{new Date(vol2Res.creneau?.date_vol).toLocaleDateString("fr-FR")} · {vol2Res.creneau?.heure_debut?.slice(0, 5)}</p>
                    <p className="text-xs text-gray-500">{vol2Res.creneau?.pilote?.prenom} {vol2Res.creneau?.pilote?.nom}</p>
                  </div>
                ) : e.vol2_autorise ? (
                  <div><p className="text-sm font-semibold text-amber-600 mb-1">🟡 Vol 2 autorise</p><Link href="/dashboard/reservation" className="text-xs text-brand-500 font-semibold hover:underline">Reserver →</Link></div>
                ) : e.bia_resultat ? (
                  <p className="text-sm font-semibold text-emerald-700">🎓 {e.bia_resultat}</p>
                ) : (
                  <p className="text-sm text-gray-500">En attente de l&apos;examen</p>
                )}
              </div>
            </div>

            {/* Upcoming flights detail */}
            {activeRes.filter((r: any) => r.statut !== "effectue" && r.creneau).length > 0 && (
              <div className="p-4 bg-brand-50 rounded-lg">
                <p className="text-xs font-semibold text-brand-600 uppercase tracking-wider mb-2">Prochain vol</p>
                {activeRes.filter((r: any) => r.statut !== "effectue" && r.creneau).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{new Date(r.creneau.date_vol).toLocaleDateString("fr-FR")} · {r.creneau.heure_debut?.slice(0, 5)} - {r.creneau.heure_fin?.slice(0, 5)}</p>
                      <p className="text-xs text-gray-600">{r.creneau.aeronef?.type_aeronef} ({r.creneau.aeronef?.immatriculation})</p>
                    </div>
                    <Link href="/dashboard/reservation" className="btn-secondary btn-sm">Voir les details →</Link>
                  </div>
                ))}
              </div>
            )}
          </div>
          );
        })
      ) : (
        <div className="card text-center py-12">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Aucun enfant inscrit pour le moment.</p>
          <p className="text-sm text-gray-400 mt-1">L&apos;aéroclub vous informera par email lorsque l&apos;inscription sera effectuee.</p>
        </div>
      )}

      {/* Contact */}
      <div className="card mt-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">Contact</h2>
        <p className="text-sm text-gray-700 font-medium">{contactNom}</p>
        <p className="text-sm text-gray-500">{contactEmail}</p>
        {contactTel && <p className="text-sm text-gray-500">{contactTel}</p>}
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  const supabase = await createServerSupabaseClient();
  const roles = profile.roles || [];

  if (roles.includes("superadmin")) return <DashboardSuperAdmin supabase={supabase} />;
  if (roles.includes("coordinateur")) return <DashboardCoordinateur supabase={supabase} profile={profile} />;
  if (roles.includes("pilote")) return <DashboardPilote supabase={supabase} profile={profile} />;
  if (roles.includes("gerant")) return <DashboardGerant supabase={supabase} profile={profile} />;
  if (roles.includes("parent")) return <DashboardParent supabase={supabase} profile={profile} />;

  return (
    <div className="card text-center py-12">
      <p className="text-gray-500">Aucun rôle attribué. Contactez l&apos;administrateur.</p>
    </div>
  );
}
