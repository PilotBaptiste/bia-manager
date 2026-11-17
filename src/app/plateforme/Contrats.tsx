"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileText, Loader2, Printer, Save, Trash2, Building2, Check, AlertTriangle, X, Pencil, Send, ShieldCheck, Download,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { documentContrat, STATUTS, TYPES_CONTRAT, type Contrat, type TypeContrat } from "@/lib/contrats";
import { editeurEnv, type Editeur } from "@/lib/legal";

type Club = { id: string; nom: string; slug: string; actif: boolean };

const vide = (organisationId: string, type: TypeContrat): Contrat => ({
  organisation_id: organisationId,
  type,
  reference: null,
  club_raison_sociale: null,
  club_adresse: null,
  club_siret: null,
  club_representant: null,
  club_fonction: null,
  club_email: null,
  date_effet: null,
  date_fin: null,
  montant_annuel: null,
  statut: "brouillon",
  envoye_le: null,
  signe_le: null,
  signe_par: null,
  resilie_le: null,
  clauses_particulieres: null,
  notes: null,
});

const fmt = (d: string | null | undefined) =>
  d ? new Date(`${d.slice(0, 10)}T12:00:00`).toLocaleDateString("fr-FR") : "—";

/**
 * Centralise l'identité de l'éditeur et les contrats signés avec chaque club.
 * La même identité sert aux mentions légales du site public.
 */
export default function Contrats({ clubs }: { clubs: Club[] }) {
  const [parametres, setParametres] = useState<Record<string, string>>({});
  const [contrats, setContrats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editionIdentite, setEditionIdentite] = useState(false);
  const [edition, setEdition] = useState<{ club: Club; contrat: Contrat } | null>(null);
  const [suppression, setSuppression] = useState<any | null>(null);
  const [envoiPour, setEnvoiPour] = useState<any | null>(null);
  const [telechargement, setTelechargement] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [pR, cR] = await Promise.all([
      fetch("/api/plateforme/parametres").then((r) => r.json()).catch(() => ({})),
      fetch("/api/plateforme/contrats").then((r) => r.json()).catch(() => ({})),
    ]);
    if (pR?.error) toast.error(pR.error);
    setParametres(pR?.parametres ?? {});
    setContrats(cR?.contrats ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  /** L'identité telle qu'elle apparaîtra : base d'abord, variables ensuite. */
  const editeur: Editeur = useMemo(() => {
    const env = editeurEnv();
    const ou = (v: unknown, secours: string) => (String(v ?? "").trim() || secours);
    const nom = ou(parametres.editeur_nom, env.nom);
    const adresse = ou(parametres.editeur_adresse, env.adresse);
    const email = ou(parametres.editeur_email, env.email);
    return {
      nom,
      statut: ou(parametres.editeur_statut, env.statut),
      siret: ou(parametres.editeur_siret, env.siret),
      adresse,
      email,
      directeur: ou(parametres.editeur_directeur, env.directeur) || nom,
      complet: !!(nom && adresse && email),
    };
  }, [parametres]);

  const parClub = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of contrats) {
      const liste = m.get(c.organisation_id) ?? [];
      liste.push(c);
      m.set(c.organisation_id, liste);
    }
    return m;
  }, [contrats]);

  function imprimer(contrat: Contrat, nomClub: string) {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Fenêtre bloquée — autorisez les popups"); return; }
    w.document.write(documentContrat(contrat, nomClub, editeur));
    w.document.close();
    w.focus();
  }

  /** L'exemplaire signé, archivé tel qu'il a été montré au signataire. */
  async function ouvrirSigne(c: any) {
    if (!c.document_path) return;
    setTelechargement(c.id);
    const { data, error } = await createClient().storage.from("contrats").download(c.document_path);
    setTelechargement(null);
    if (error || !data) { toast.error(error?.message ?? "Document introuvable"); return; }
    const w = window.open("", "_blank");
    if (!w) { toast.error("Fenêtre bloquée — autorisez les popups"); return; }
    w.document.write(await data.text());
    w.document.close();
    w.focus();
  }

  async function supprimer(c: any) {
    const res = await fetch(`/api/plateforme/contrats?id=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    setSuppression(null);
    if (!res.ok) { toast.error(json.error ?? "Suppression impossible"); return; }
    toast.success("Contrat supprimé");
    load();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-brand-400" /></div>;
  }

  const manquants = clubs.filter((c) => c.actif && !(parClub.get(c.id) ?? []).some((x) => x.type === "sous_traitance" && x.statut === "signe"));

  return (
    <div className="space-y-5">
      {/* ── Identité de l'éditeur ── */}
      <div className={`rounded-xl border p-4 ${editeur.complet ? "border-gray-200 bg-white" : "border-amber-200 bg-amber-50/50"}`}>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-gray-900">Identité de l&apos;éditeur</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Apparaît sur les mentions légales du site et en tête de chaque contrat.
            </p>
          </div>
          <button onClick={() => setEditionIdentite(true)} className="btn-secondary btn-sm">
            <Pencil className="w-3.5 h-3.5" /> Modifier
          </button>
        </div>
        {editeur.complet ? (
          <p className="text-sm text-gray-700 mt-3">
            <strong>{editeur.nom}</strong>
            {editeur.statut ? ` — ${editeur.statut}` : ""}
            {editeur.siret ? ` · SIRET ${editeur.siret}` : ""}
            <br />
            <span className="text-gray-500">{editeur.adresse} · {editeur.email}</span>
          </p>
        ) : (
          <p className="text-sm text-amber-800 mt-3 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Non renseignée : les mentions légales affichent « à compléter », et les contrats sortiront avec des
            champs vides. Nom, adresse et email sont le minimum.
          </p>
        )}
      </div>

      {manquants.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            <strong>{manquants.length} aéroclub{manquants.length > 1 ? "s" : ""}</strong> sans contrat de
            sous-traitance signé : {manquants.map((c) => c.nom).join(", ")}. Ce contrat est obligatoire dès qu&apos;un
            club confie des données d&apos;élèves à la plateforme.
          </span>
        </div>
      )}

      {/* ── Un bloc par club ── */}
      {clubs.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-12 text-center text-sm text-gray-400">
          Aucun aéroclub.
        </div>
      ) : (
        <div className="space-y-3">
          {clubs.map((club) => {
            const siens = parClub.get(club.id) ?? [];
            return (
              <div key={club.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50/60 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="w-4 h-4 text-brand-500 shrink-0" />
                    <p className={`font-semibold ${club.actif ? "text-gray-900" : "text-gray-500"}`}>{club.nom}</p>
                    {!club.actif && <span className="badge bg-gray-200 text-gray-600">Désactivé</span>}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {TYPES_CONTRAT.map((t) => {
                      const existe = siens.find((c) => c.type === t.valeur);
                      return (
                        <button
                          key={t.valeur}
                          onClick={() =>
                            setEdition({ club, contrat: existe ? { ...existe } : vide(club.id, t.valeur) })
                          }
                          className="btn-secondary btn-sm"
                          title={t.description}
                        >
                          {existe ? <Pencil className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {siens.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-gray-400">Aucun contrat établi pour ce club.</p>
                ) : (
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100">
                      {siens.map((c) => {
                        const st = STATUTS.find((s) => s.valeur === c.statut);
                        return (
                          <tr key={c.id}>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-gray-800">
                                {TYPES_CONTRAT.find((t) => t.valeur === c.type)?.label ?? c.type}
                              </p>
                              {c.reference && <p className="text-[11px] text-gray-400">Réf. {c.reference}</p>}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className={`badge ${st?.couleur ?? "bg-gray-100 text-gray-600"}`}>{st?.label ?? c.statut}</span>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                              Effet : {fmt(c.date_effet)}
                              {c.statut === "signe" && ` · signé le ${fmt(c.signe_le)}`}
                              {c.statut === "signe" && c.signature_nom && (
                                <p className="text-[11px] text-emerald-600 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" /> {c.signature_nom} · {c.signature_id}
                                </p>
                              )}
                              {c.statut === "envoye" && c.signataire_email && (
                                <p className="text-[11px] text-amber-600">En attente de {c.signataire_email}</p>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center justify-end gap-1.5">
                                {c.statut === "signe" && c.document_path ? (
                                  <button onClick={() => ouvrirSigne(c)} disabled={telechargement === c.id} className="btn-secondary btn-sm" title="Relire l'exemplaire signé et son certificat">
                                    {telechargement === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                    Exemplaire signé
                                  </button>
                                ) : (
                                  <button onClick={() => setEnvoiPour({ contrat: c, club })} className="btn-primary btn-sm" title="Envoyer le lien de signature au représentant du club">
                                    <Send className="w-3.5 h-3.5" /> {c.statut === "envoye" ? "Relancer" : "Envoyer à signer"}
                                  </button>
                                )}
                                <button onClick={() => imprimer(c, club.nom)} className="btn-secondary btn-sm" title="Ouvrir le document, prêt à imprimer ou enregistrer en PDF">
                                  <Printer className="w-3.5 h-3.5" /> Document
                                </button>
                                <button onClick={() => setSuppression(c)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600" title="Supprimer">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editionIdentite && (
        <FormulaireIdentite
          parametres={parametres}
          onFerme={() => setEditionIdentite(false)}
          onEnregistre={(p) => { setParametres(p); setEditionIdentite(false); }}
        />
      )}

      {edition && (
        <FormulaireContrat
          club={edition.club}
          contrat={edition.contrat}
          editeur={editeur}
          onFerme={() => setEdition(null)}
          onEnregistre={() => { setEdition(null); load(); }}
        />
      )}

      {envoiPour && (
        <EnvoiSignature
          contrat={envoiPour.contrat}
          club={envoiPour.club}
          onFerme={() => setEnvoiPour(null)}
          onEnvoye={() => { setEnvoiPour(null); load(); }}
        />
      )}

      {suppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setSuppression(null)} />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <h3 className="font-bold text-gray-900 mb-1">Supprimer ce contrat ?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Le contrat et ses informations juridiques seront effacés. Le club et ses données ne sont pas touchés.
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSuppression(null)} className="btn-secondary">Annuler</button>
              <button onClick={() => supprimer(suppression)} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Champ({
  label,
  valeur,
  onChange,
  placeholder,
  type = "text",
  aide,
}: {
  label: string;
  valeur: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  aide?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} value={valeur} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="input" />
      {aide && <p className="text-[11px] text-gray-400 mt-0.5">{aide}</p>}
    </div>
  );
}

function FormulaireIdentite({
  parametres,
  onFerme,
  onEnregistre,
}: {
  parametres: Record<string, string>;
  onFerme: () => void;
  onEnregistre: (p: Record<string, string>) => void;
}) {
  const [form, setForm] = useState({
    editeur_nom: parametres.editeur_nom ?? "",
    editeur_statut: parametres.editeur_statut ?? "",
    editeur_siret: parametres.editeur_siret ?? "",
    editeur_adresse: parametres.editeur_adresse ?? "",
    editeur_email: parametres.editeur_email ?? "",
    editeur_telephone: parametres.editeur_telephone ?? "",
    editeur_directeur: parametres.editeur_directeur ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function enregistrer() {
    setSaving(true);
    const res = await fetch("/api/plateforme/parametres", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Enregistrement impossible"); return; }
    toast.success("Identité enregistrée");
    onEnregistre(json.parametres ?? form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFerme} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-xl shadow-xl max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Identité de l&apos;éditeur</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Utilisée par les mentions légales publiques et par l&apos;en-tête des contrats.
            </p>
          </div>
          <button onClick={onFerme} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Champ label="Nom ou raison sociale *" valeur={form.editeur_nom} onChange={(v) => setForm({ ...form, editeur_nom: v })} placeholder="Jean Dupont, ou BIA Manager SASU" />
          </div>
          <Champ label="Forme juridique" valeur={form.editeur_statut} onChange={(v) => setForm({ ...form, editeur_statut: v })} placeholder="Auto-entrepreneur, Association loi 1901…" />
          <Champ label="SIRET" valeur={form.editeur_siret} onChange={(v) => setForm({ ...form, editeur_siret: v })} placeholder="Si structure immatriculée" />
          <div className="sm:col-span-2">
            <Champ label="Adresse *" valeur={form.editeur_adresse} onChange={(v) => setForm({ ...form, editeur_adresse: v })} placeholder="12 rue de l'Aérodrome, 33260 La Teste-de-Buch" />
          </div>
          <Champ label="Email de contact *" type="email" valeur={form.editeur_email} onChange={(v) => setForm({ ...form, editeur_email: v })} aide="Affiché publiquement pour les demandes RGPD." />
          <Champ label="Téléphone" valeur={form.editeur_telephone} onChange={(v) => setForm({ ...form, editeur_telephone: v })} />
          <div className="sm:col-span-2">
            <Champ label="Directeur de la publication" valeur={form.editeur_directeur} onChange={(v) => setForm({ ...form, editeur_directeur: v })} aide="Laissé vide, reprend le nom de l'éditeur." />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFerme} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

function FormulaireContrat({
  club,
  contrat,
  editeur,
  onFerme,
  onEnregistre,
}: {
  club: Club;
  contrat: Contrat;
  editeur: Editeur;
  onFerme: () => void;
  onEnregistre: () => void;
}) {
  const [form, setForm] = useState<any>({
    ...contrat,
    club_raison_sociale: contrat.club_raison_sociale ?? club.nom,
    montant_annuel: contrat.montant_annuel ?? "",
    reference: contrat.reference ?? "",
    club_adresse: contrat.club_adresse ?? "",
    club_siret: contrat.club_siret ?? "",
    club_representant: contrat.club_representant ?? "",
    club_fonction: contrat.club_fonction ?? "",
    club_email: contrat.club_email ?? "",
    date_effet: contrat.date_effet ?? "",
    date_fin: contrat.date_fin ?? "",
    signe_le: contrat.signe_le ?? "",
    signe_par: contrat.signe_par ?? "",
    clauses_particulieres: contrat.clauses_particulieres ?? "",
    notes: contrat.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const typeLabel = TYPES_CONTRAT.find((t) => t.valeur === form.type)?.label ?? form.type;

  function maj(champ: string, valeur: any) {
    setForm((f: any) => ({ ...f, [champ]: valeur }));
  }

  async function enregistrer() {
    setSaving(true);
    const res = await fetch("/api/plateforme/contrats", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { toast.error(json.error ?? "Enregistrement impossible"); return; }
    toast.success("Contrat enregistré");
    onEnregistre();
  }

  function apercu() {
    const w = window.open("", "_blank");
    if (!w) { toast.error("Fenêtre bloquée — autorisez les popups"); return; }
    w.document.write(documentContrat({ ...form, montant_annuel: form.montant_annuel === "" ? null : Number(form.montant_annuel) }, club.nom, editeur));
    w.document.close();
    w.focus();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFerme} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-auto">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{typeLabel}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{club.nom}</p>
          </div>
          <button onClick={onFerme} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {!editeur.complet && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              L&apos;identité de l&apos;éditeur n&apos;est pas renseignée : le document sortira avec des champs
              surlignés en jaune. Renseignez-la avant d&apos;envoyer le contrat.
            </p>
          </div>
        )}

        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-2">L&apos;aéroclub au contrat</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <div className="sm:col-span-2">
            <Champ label="Raison sociale" valeur={form.club_raison_sociale} onChange={(v) => maj("club_raison_sociale", v)} aide="Le nom officiel de l'association, qui peut différer du nom affiché dans l'application." />
          </div>
          <div className="sm:col-span-2">
            <Champ label="Adresse" valeur={form.club_adresse} onChange={(v) => maj("club_adresse", v)} />
          </div>
          <Champ label="SIRET" valeur={form.club_siret} onChange={(v) => maj("club_siret", v)} />
          <Champ label="Email" type="email" valeur={form.club_email} onChange={(v) => maj("club_email", v)} />
          <Champ label="Représenté par" valeur={form.club_representant} onChange={(v) => maj("club_representant", v)} placeholder="Nom du signataire" />
          <Champ label="En qualité de" valeur={form.club_fonction} onChange={(v) => maj("club_fonction", v)} placeholder="Président, Trésorier…" />
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-2">Le contrat</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
          <Champ label="Référence" valeur={form.reference} onChange={(v) => maj("reference", v)} placeholder="2026-001" />
          <div>
            <label className="label">Statut</label>
            <select value={form.statut} onChange={(e) => maj("statut", e.target.value)} className="select">
              {STATUTS.map((s) => <option key={s.valeur} value={s.valeur}>{s.label}</option>)}
            </select>
          </div>
          <Champ label="Date d'effet" type="date" valeur={form.date_effet} onChange={(v) => maj("date_effet", v)} />
          <Champ label="Échéance" type="date" valeur={form.date_fin} onChange={(v) => maj("date_fin", v)} />
          {form.type === "abonnement" && (
            <Champ label="Montant annuel (€)" type="number" valeur={String(form.montant_annuel ?? "")} onChange={(v) => maj("montant_annuel", v)} />
          )}
          {form.statut === "signe" && (
            <>
              <Champ label="Signé le" type="date" valeur={form.signe_le} onChange={(v) => maj("signe_le", v)} />
              <Champ label="Signé par" valeur={form.signe_par} onChange={(v) => maj("signe_par", v)} />
            </>
          )}
        </div>

        <div className="mb-3">
          <label className="label">Clauses particulières <span className="font-normal text-gray-400">(optionnel)</span></label>
          <textarea
            value={form.clauses_particulieres}
            onChange={(e) => maj("clauses_particulieres", e.target.value)}
            className="input"
            rows={3}
            placeholder="Ce que ce club négocie en plus du texte standard. Imprimé en avant-dernier article."
          />
        </div>
        <div className="mb-5">
          <label className="label">Notes internes <span className="font-normal text-gray-400">(jamais imprimées)</span></label>
          <textarea value={form.notes} onChange={(e) => maj("notes", e.target.value)} className="input" rows={2} />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={apercu} className="btn-secondary mr-auto">
            <Printer className="w-4 h-4" /> Aperçu du document
          </button>
          <button onClick={onFerme} className="btn-secondary">Annuler</button>
          <button onClick={enregistrer} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}

/** Envoi du lien de signature au représentant du club. */
function EnvoiSignature({
  contrat,
  club,
  onFerme,
  onEnvoye,
}: {
  contrat: any;
  club: Club;
  onFerme: () => void;
  onEnvoye: () => void;
}) {
  const [email, setEmail] = useState(contrat.signataire_email ?? contrat.club_email ?? "");
  const [occupe, setOccupe] = useState(false);
  const [lien, setLien] = useState<string | null>(null);
  const manquePrerequis = !contrat.club_representant;

  async function envoyer() {
    setOccupe(true);
    const res = await fetch("/api/plateforme/contrats/envoyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: contrat.id, email }),
    });
    const json = await res.json().catch(() => ({}));
    setOccupe(false);
    if (!res.ok) {
      toast.error(json.error ?? "Envoi impossible");
      if (json.lien) setLien(json.lien);
      return;
    }
    if (json.email_envoye) {
      toast.success(`Lien de signature envoyé à ${email}`);
      onEnvoye();
    } else {
      // Pas de service d'envoi : on donne le lien à transmettre à la main.
      setLien(json.lien);
      toast.warning("Email non configuré — transmettez le lien vous-même");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onFerme} />
      <div className="relative bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Envoyer à signer</h3>
            <p className="text-xs text-gray-500 mt-0.5">{club.nom}</p>
          </div>
          <button onClick={onFerme} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {manquePrerequis ? (
          <div className="p-3 rounded-lg bg-amber-50 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800">
              Renseignez d&apos;abord le <strong>représentant du club</strong> dans le contrat : c&apos;est le nom
              que le signataire devra taper, et qui fait foi.
            </p>
          </div>
        ) : lien ? (
          <>
            <p className="text-sm text-gray-600 mb-2">Transmettez ce lien au signataire :</p>
            <input readOnly value={lien} onFocus={(e) => e.currentTarget.select()} className="input text-xs" />
          </>
        ) : (
          <>
            <label className="label">Adresse du signataire</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="president@aeroclub.fr" />
            <p className="text-[11px] text-gray-500 mt-2">
              Le code de signature partira à cette même adresse : c&apos;est ce qui prouve que la signature vient
              bien de son titulaire. Le lien est valable 30 jours.
            </p>
          </>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onFerme} className="btn-secondary">Fermer</button>
          {!manquePrerequis && !lien && (
            <button onClick={envoyer} disabled={occupe || !email.trim()} className="btn-primary">
              {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
