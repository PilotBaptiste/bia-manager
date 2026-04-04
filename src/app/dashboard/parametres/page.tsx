"use client";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Settings2, Save, Loader2, FileSignature, Download, Eye, Info } from "lucide-react";

const DEFAULT_TEMPLATE = `Je soussigné(e) {PARENT_NOM}, parent/responsable légal de {ELEVE_PRENOM} {ELEVE_NOM}, né(e) le {ELEVE_DATE_NAISSANCE} à {ELEVE_LIEU_NAISSANCE}, autorise mon enfant à effectuer un vol découverte au sein de l'Aéro-Club du Bassin d'Arcachon dans le cadre du Brevet d'Initiation Aéronautique (BIA).

Je déclare avoir pris connaissance des conditions de vol et des mesures de sécurité en vigueur.

Fait à {LIEU_SIGNATURE}, le {DATE_SIGNATURE}`;

export default function ParametresPage() {
  const supabase = createClient();
  const [params, setParams] = useState<any[]>([]);
  const [templateText, setTemplateText] = useState(DEFAULT_TEMPLATE);
  const [attestations, setAttestations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState<"general" | "template" | "attestations">("general");

  useEffect(() => {
    async function load() {
      const [pR, eR] = await Promise.all([
        supabase.from("parametres").select("*").order("cle"),
        supabase.from("eleves").select("nom, prenom, attestation_signee, attestation_date, attestation_parent_signataire, attestation_url, etablissement:etablissements(nom)").eq("attestation_signee", true).order("attestation_date", { ascending: false }),
      ]);
      setParams(pR.data || []);
      const tpl = (pR.data || []).find((p: any) => p.cle === "template_attestation");
      if (tpl) setTemplateText(tpl.valeur);
      setAttestations(eR.data || []);
      setLoading(false);
    }
    load();
  }, []);

  function updateParam(cle: string, valeur: string) {
    setParams(prev => prev.map(p => p.cle === cle ? { ...p, valeur } : p));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    for (const p of params) {
      await supabase.from("parametres").update({ valeur: p.valeur }).eq("cle", p.cle);
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleSaveTemplate() {
    setSaving(true);
    // Check if template param exists
    const existing = params.find(p => p.cle === "template_attestation");
    if (existing) {
      await supabase.from("parametres").update({ valeur: templateText }).eq("cle", "template_attestation");
    } else {
      await supabase.from("parametres").insert({ cle: "template_attestation", valeur: templateText, description: "Template de l attestation parentale" });
    }
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function downloadAttestation(attestation: any) {
    if (!attestation.attestation_url) return;
    const fileName = attestation.attestation_url.includes("/")
      ? attestation.attestation_url.split("/").pop()
      : attestation.attestation_url;
    const { data, error } = await supabase.storage.from("attestations").download(fileName);
    if (data) {
      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attestation_${attestation.nom}_${attestation.prenom}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  const labels: Record<string, string> = {
    prix_inscription: "Prix inscription (€)",
    subvention_federation: "Subvention fédération / BIA réussi (€)",
    duree_cible_vols: "Durée cible totale 2 vols (min)",
    nom_aeroclub: "Nom de l'aéroclub",
    email_aeroclub: "Email de contact",
    telephone_aeroclub: "Téléphone",
  };

  const variables = [
    { var: "{PARENT_NOM}", desc: "Prénom + Nom du parent" },
    { var: "{PARENT_PRENOM}", desc: "Prénom du parent" },
    { var: "{PARENT_NOM_FAMILLE}", desc: "Nom de famille du parent" },
    { var: "{ELEVE_PRENOM}", desc: "Prénom de l'élève" },
    { var: "{ELEVE_NOM}", desc: "Nom de l'élève" },
    { var: "{ELEVE_DATE_NAISSANCE}", desc: "Date de naissance" },
    { var: "{ELEVE_LIEU_NAISSANCE}", desc: "Lieu de naissance" },
    { var: "{ETABLISSEMENT}", desc: "Nom de l'établissement" },
    { var: "{DATE_SIGNATURE}", desc: "Date de signature" },
    { var: "{ANNEE}", desc: "Année en cours" },
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Paramètres</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configuration générale — SuperAdmin</p>
        </div>
      </div>

      {saved && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          ✅ Enregistré avec succès
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-lg p-0.5 w-fit">
        {[
          { key: "general", label: "Général", icon: Settings2 },
          { key: "template", label: "Template attestation", icon: FileSignature },
          { key: "attestations", label: "Attestations signées", icon: Eye },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-xs font-semibold transition-all ${tab === key ? "bg-white text-brand-500 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "general" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-brand-400" /> Tarification
            </h2>
            {params.filter(p => ["prix_inscription", "subvention_federation", "duree_cible_vols"].includes(p.cle)).map(p => (
              <div key={p.cle} className="mb-3">
                <label className="label">{labels[p.cle] || p.cle}</label>
                <input type="number" value={p.valeur} onChange={e => updateParam(p.cle, e.target.value)} className="input" />
                {p.description && <p className="text-[11px] text-gray-400 mt-1">{p.description}</p>}
              </div>
            ))}
          </div>
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-brand-400" /> Informations aéroclub
            </h2>
            {params.filter(p => ["nom_aeroclub", "email_aeroclub", "telephone_aeroclub"].includes(p.cle)).map(p => (
              <div key={p.cle} className="mb-3">
                <label className="label">{labels[p.cle] || p.cle}</label>
                <input value={p.valeur} onChange={e => updateParam(p.cle, e.target.value)} className="input" />
              </div>
            ))}
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer
            </button>
          </div>
        </div>
      )}

      {tab === "template" && (
        <div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Texte de l&apos;attestation</h2>
              <p className="text-xs text-gray-500 mb-3">Modifiez le texte ci-dessous. Utilisez les variables entre accolades pour insérer automatiquement les données de chaque élève.</p>
              <textarea
                value={templateText}
                onChange={e => setTemplateText(e.target.value)}
                className="input min-h-[300px] resize-y font-mono text-xs"
              />
              <div className="flex justify-between items-center mt-4">
                <button onClick={() => setTemplateText(DEFAULT_TEMPLATE)} className="text-xs text-gray-400 hover:text-gray-600">
                  Réinitialiser le template par défaut
                </button>
                <button onClick={handleSaveTemplate} disabled={saving} className="btn-primary">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Enregistrer le template
                </button>
              </div>
            </div>
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-brand-400" /> Variables disponibles
              </h2>
              <div className="space-y-2">
                {variables.map(v => (
                  <div key={v.var} className="flex items-start gap-2">
                    <code className="text-[10px] bg-brand-50 text-brand-500 px-1.5 py-0.5 rounded font-mono whitespace-nowrap">{v.var}</code>
                    <span className="text-xs text-gray-500">{v.desc}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-400">
                  Le PDF sera généré automatiquement avec la signature manuscrite du parent, la date et l&apos;heure de signature.
                  Le document sera stocké de manière sécurisée et accessible uniquement par vous (SuperAdmin).
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "attestations" && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Attestations signées ({attestations.length})</h2>
          {attestations.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Aucune attestation signée pour le moment.</p>
          ) : (
            <div className="space-y-2">
              {attestations.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.prenom} {a.nom}</p>
                    <p className="text-xs text-gray-500">
                      {a.etablissement?.nom} · Signé le {new Date(a.attestation_date).toLocaleDateString("fr-FR")} par {a.attestation_parent_signataire}
                    </p>
                  </div>
                  <button onClick={() => downloadAttestation(a)} className="btn-secondary btn-sm">
                    <Download className="w-3.5 h-3.5" /> PDF
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
