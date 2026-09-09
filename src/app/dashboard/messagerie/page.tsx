"use client";
import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useYear } from "@/contexts/YearContext";
import { Mail, Users, School, Filter, X, Send, ChevronRight, ChevronLeft, Check, AlertCircle, Search } from "lucide-react";

const supabase = createClient();

type CritereKey =
  | "vol1_manquant"
  | "vol2_manquant"
  | "bia_reussi"
  | "sans_paiement"
  | "sans_attestation"
  | "vol2_autorise_pas_effectue";

const CRITERES: { key: CritereKey; label: string; description: string }[] = [
  { key: "vol1_manquant", label: "✈️ Vol 1 non effectué", description: "Paiement + attestation OK, vol 1 pas encore fait" },
  { key: "vol2_manquant", label: "🛫 Vol 2 non effectué", description: "BIA réussi + vol 1 fait, vol 2 pas encore fait" },
  { key: "vol2_autorise_pas_effectue", label: "🛬 Vol 2 autorisé mais pas fait", description: "A le BIA, est autorisé vol 2, mais n'a pas encore volé" },
  { key: "bia_reussi", label: "🎓 BIA réussi", description: "L'élève a réussi le BIA (Admis ou Mention)" },
  { key: "sans_paiement", label: "💳 Sans paiement", description: "Paiement non encore enregistré" },
  { key: "sans_attestation", label: "📝 Sans attestation", description: "Attestation parentale non encore signée" },
];

export default function MessageriePage() {
  const searchParams = useSearchParams();
  const { selectedAnneeId } = useYear();

  const [etablissements, setEtablissements] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [mode, setMode] = useState<"etab" | "eleve" | "critere">("etab");

  // Par établissement
  const [selectedEtabs, setSelectedEtabs] = useState<string[]>([]);

  // Par élève
  const [selectedEleves, setSelectedEleves] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterEtabEleve, setFilterEtabEleve] = useState<string>("");

  // Par critère
  const [selectedCritere, setSelectedCritere] = useState<CritereKey | null>(null);
  const [critereEtab, setCritereEtab] = useState<string>("");

  // Step 2
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Step 3
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors?: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setSenderEmail(user.email);

      const [{ data: profData }, { data: etabsAll }, { data: elevesData }] = await Promise.all([
        user
          ? supabase.from("profiles").select("roles, etablissement_id, etablissement_ids").eq("id", user.id).single()
          : Promise.resolve({ data: null }),
        supabase.from("etablissements").select("id, nom").order("nom"),
        supabase.from("eleves")
          .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, annee_id, archive, vol1_effectue, vol1_skippe, vol2_effectue, vol2_autorise, paiement_effectue, attestation_signee, bia_passe, bia_resultat")
          .eq("archive", false)
          .not("parent_email", "is", null)
          .order("nom"),
      ]);

      const isCoord = profData?.roles?.includes("coordinateur") && !profData?.roles?.includes("superadmin");
      const coordEtabIds: string[] = isCoord
        ? (profData?.etablissement_ids?.length > 0 ? profData.etablissement_ids : profData?.etablissement_id ? [profData.etablissement_id] : [])
        : [];

      const filteredEtabs = coordEtabIds.length > 0
        ? (etabsAll ?? []).filter((e: any) => coordEtabIds.includes(e.id))
        : (etabsAll ?? []);

      setEtablissements(filteredEtabs);
      setEleves(elevesData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Handle ?eleves=id1,id2,... URL param — pre-select students and switch to "élève" mode
  useEffect(() => {
    const elevesParam = searchParams.get("eleves");
    if (elevesParam && eleves.length > 0) {
      const ids = elevesParam.split(",").filter(Boolean);
      if (ids.length > 0) {
        setSelectedEleves(ids);
        setMode("eleve");
      }
    }
  }, [searchParams, eleves]);

  // Elèves filtered by selected year (if any)
  const elevesAnnee = useMemo(() => {
    if (!selectedAnneeId) return eleves;
    return eleves.filter((e: any) => e.annee_id === selectedAnneeId);
  }, [eleves, selectedAnneeId]);

  // Par critère — filtered elèves matching the selected criterion
  const elevesByCritere = useMemo(() => {
    if (!selectedCritere) return [];
    return elevesAnnee.filter((e: any) => {
      if (critereEtab && e.etablissement_id !== critereEtab) return false;
      switch (selectedCritere) {
        case "vol1_manquant":
          return e.paiement_effectue && e.attestation_signee && !e.vol1_effectue && !e.vol1_skippe;
        case "vol2_manquant":
          return e.vol2_autorise && (e.vol1_effectue || e.vol1_skippe) && !e.vol2_effectue;
        case "vol2_autorise_pas_effectue":
          return e.vol2_autorise && !e.vol2_effectue;
        case "bia_reussi":
          return e.bia_resultat === "Admis" || e.bia_resultat === "Mention";
        case "sans_paiement":
          return !e.paiement_effectue;
        case "sans_attestation":
          return !e.attestation_signee;
        default:
          return false;
      }
    });
  }, [elevesAnnee, selectedCritere, critereEtab]);

  // Recipients computed from selection mode
  const recipients = useMemo(() => {
    const list: { email: string; eleve_prenom: string; eleve_nom: string; etab_id: string; eleve_id: string }[] = [];
    const seen = new Set<string>();

    const addEleve = (e: any) => {
      if (!e.parent_email) return;
      if (seen.has(e.parent_email)) return;
      seen.add(e.parent_email);
      list.push({ email: e.parent_email, eleve_prenom: e.prenom, eleve_nom: e.nom, etab_id: e.etablissement_id, eleve_id: e.id });
    };

    if (mode === "etab") {
      for (const e of elevesAnnee) {
        if (selectedEtabs.includes(e.etablissement_id)) addEleve(e);
      }
    } else if (mode === "eleve") {
      for (const e of elevesAnnee) {
        if (selectedEleves.includes(e.id)) addEleve(e);
      }
    } else {
      for (const e of elevesByCritere) addEleve(e);
    }

    return list;
  }, [mode, selectedEtabs, selectedEleves, elevesByCritere, elevesAnnee]);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return elevesAnnee.filter((e: any) => {
      if (filterEtabEleve && e.etablissement_id !== filterEtabEleve) return false;
      if (q && !`${e.prenom} ${e.nom} ${e.parent_email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [elevesAnnee, search, filterEtabEleve]);

  async function handleSend() {
    if (!subject.trim() || !body.trim() || recipients.length === 0) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "custom",
          recipients: recipients.map(r => ({ email: r.email, eleve_id: r.eleve_id })),
          subject,
          body,
          sender_email: senderEmail,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur envoi");
      setResult({ sent: data.sent, errors: data.errors });
      setStep(3);
    } catch (e: any) {
      setSendError(e.message);
    } finally {
      setSending(false);
    }
  }

  function reset() {
    setStep(1);
    setSelectedEtabs([]);
    setSelectedEleves([]);
    setSelectedCritere(null);
    setCritereEtab("");
    setSubject("");
    setBody("");
    setResult(null);
    setSendError(null);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Mail className="w-5 h-5 text-brand-500" />
          <h1 className="text-xl font-bold text-gray-900">Messagerie</h1>
        </div>
        <p className="text-sm text-gray-500">Envoyez un email personnalisé aux parents d'élèves.</p>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {[
          { n: 1, label: "Destinataires" },
          { n: 2, label: "Rédiger" },
          { n: 3, label: "Envoyé" },
        ].map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="w-3 h-3 text-gray-300" />}
            <div className={`flex items-center gap-1.5 ${step === n ? "text-brand-500" : step > n ? "text-emerald-500" : "text-gray-400"}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${step === n ? "bg-brand-500 text-white" : step > n ? "bg-emerald-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                {step > n ? <Check className="w-3 h-3" /> : n}
              </span>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* ── STEP 1: Recipients ── */}
      {step === 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="font-semibold text-gray-900 text-sm">Choisir les destinataires</h2>

          {/* Mode toggle */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setMode("etab")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${mode === "etab" ? "bg-brand-50 border-brand-200 text-brand-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              <School className="w-4 h-4" /> Par établissement
            </button>
            <button
              onClick={() => setMode("eleve")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${mode === "eleve" ? "bg-brand-50 border-brand-200 text-brand-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              <Users className="w-4 h-4" /> Par élève
            </button>
            <button
              onClick={() => setMode("critere")}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all ${mode === "critere" ? "bg-brand-50 border-brand-200 text-brand-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              <Filter className="w-4 h-4" /> Par critère
            </button>
          </div>

          {/* Par établissement */}
          {mode === "etab" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Tous les parents liés à l'établissement sélectionné recevront l'email :</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {etablissements.map(etab => {
                  const count = elevesAnnee.filter((e: any) => e.etablissement_id === etab.id && e.parent_email).length;
                  const checked = selectedEtabs.includes(etab.id);
                  return (
                    <label key={etab.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-all ${checked ? "bg-brand-50 border-brand-200" : "border-gray-100 hover:bg-gray-50"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => setSelectedEtabs(prev => e.target.checked ? [...prev, etab.id] : prev.filter(x => x !== etab.id))}
                        className="accent-brand-500"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{etab.nom}</p>
                        <p className="text-xs text-gray-400">{count} parent{count !== 1 ? "s" : ""} avec email</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Par élève */}
          {mode === "eleve" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Rechercher un élève ou email parent..."
                    className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
                  />
                </div>
                <select
                  value={filterEtabEleve}
                  onChange={e => setFilterEtabEleve(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white text-gray-700"
                >
                  <option value="">Tous les établissements</option>
                  {etablissements.map(et => (
                    <option key={et.id} value={et.id}>{et.nom}</option>
                  ))}
                </select>
              </div>
              {selectedEleves.length > 0 && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs text-brand-600 font-medium">{selectedEleves.length} sélectionné{selectedEleves.length > 1 ? "s" : ""}</span>
                  <button onClick={() => setSelectedEleves([])} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                    <X className="w-3 h-3" /> Tout désélectionner
                  </button>
                </div>
              )}
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredEleves.map((e: any) => {
                  const checked = selectedEleves.includes(e.id);
                  return (
                    <label key={e.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all ${checked ? "bg-brand-50 border-brand-200" : "border-gray-100 hover:bg-gray-50"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={ev => setSelectedEleves(prev => ev.target.checked ? [...prev, e.id] : prev.filter(x => x !== e.id))}
                        className="accent-brand-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{e.prenom} {e.nom}</p>
                        <p className="text-xs text-gray-400 truncate">{e.parent_email}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Par critère */}
          {mode === "critere" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <select
                  value={critereEtab}
                  onChange={e => setCritereEtab(e.target.value)}
                  className="pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white text-gray-700"
                >
                  <option value="">Tous les établissements</option>
                  {etablissements.map(et => (
                    <option key={et.id} value={et.id}>{et.nom}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                {CRITERES.map(c => {
                  const count = elevesAnnee.filter((e: any) => {
                    if (critereEtab && e.etablissement_id !== critereEtab) return false;
                    switch (c.key) {
                      case "vol1_manquant": return e.paiement_effectue && e.attestation_signee && !e.vol1_effectue && !e.vol1_skippe;
                      case "vol2_manquant": return e.vol2_autorise && (e.vol1_effectue || e.vol1_skippe) && !e.vol2_effectue;
                      case "vol2_autorise_pas_effectue": return e.vol2_autorise && !e.vol2_effectue;
                      case "bia_reussi": return e.bia_resultat === "Admis" || e.bia_resultat === "Mention";
                      case "sans_paiement": return !e.paiement_effectue;
                      case "sans_attestation": return !e.attestation_signee;
                      default: return false;
                    }
                  }).length;
                  const active = selectedCritere === c.key;
                  return (
                    <button
                      key={c.key}
                      onClick={() => setSelectedCritere(active ? null : c.key)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg border text-left transition-all ${active ? "bg-brand-50 border-brand-300" : "border-gray-100 hover:bg-gray-50"}`}
                    >
                      <div>
                        <p className={`text-sm font-medium ${active ? "text-brand-700" : "text-gray-800"}`}>{c.label}</p>
                        <p className="text-xs text-gray-400">{c.description}</p>
                      </div>
                      <span className={`ml-3 text-xs font-bold px-2 py-0.5 rounded-full shrink-0 ${count > 0 ? (active ? "bg-brand-100 text-brand-700" : "bg-gray-100 text-gray-600") : "bg-gray-50 text-gray-400"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedCritere && elevesByCritere.length > 0 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                  <p className="text-xs font-medium text-gray-500 mb-1">Élèves concernés :</p>
                  {elevesByCritere.map((e: any) => (
                    <p key={e.id} className="text-xs text-gray-600 px-1">{e.prenom} {e.nom} <span className="text-gray-400">— {e.parent_email}</span></p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Summary */}
          {recipients.length > 0 && (
            <div className="bg-brand-50 border border-brand-100 rounded-lg px-3 py-2.5 text-sm text-brand-700 font-medium">
              {recipients.length} email{recipients.length > 1 ? "s" : ""} seront envoyés
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={() => setStep(2)}
              disabled={recipients.length === 0}
              className="flex items-center gap-2 btn-primary btn-sm disabled:opacity-40"
            >
              Suivant <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Compose ── */}
      {step === 2 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Rédiger le message</h2>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-full">{recipients.length} destinataire{recipients.length > 1 ? "s" : ""}</span>
          </div>

          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Modèles rapides :</p>
            <div className="flex flex-wrap gap-1.5">
              {[
                {
                  label: "📝 Attestation parentale",
                  subject: "Action requise : remplir l'attestation parentale BIA",
                  body: `Bonjour,\n\nNous vous contactons au sujet de la participation de votre enfant au programme BIA (Brevet d'Initiation Aéronautique).\n\nPour que votre enfant puisse réserver son vol de découverte, vous devez remplir et signer l'attestation parentale disponible dans votre espace en ligne.\n\nRendez-vous dans votre espace parent > onglet "Attestation" pour compléter cette démarche.\n\nSans cette attestation signée, aucune réservation de vol ne sera possible.\n\nCordialement,`,
                },
                {
                  label: "💳 Valider le paiement",
                  subject: "Rappel : validation du paiement BIA",
                  body: `Bonjour,\n\nNous vous rappelons que le paiement de l'activité BIA pour votre enfant n'a pas encore été enregistré dans notre système.\n\nPour que votre enfant puisse accéder aux vols de découverte, le paiement doit être validé par l'établissement ou l'aéro-club.\n\nSi vous avez déjà effectué le règlement, merci de contacter directement votre établissement scolaire afin qu'il mette à jour votre dossier.\n\nCordialement,`,
                },
                {
                  label: "✈️ Créneaux disponibles",
                  subject: "Des créneaux de vol sont disponibles !",
                  body: `Bonjour,\n\nNous avons le plaisir de vous informer que des créneaux de vol de découverte sont disponibles pour votre enfant.\n\nConnectez-vous à votre espace parent pour consulter les créneaux disponibles et effectuer votre réservation.\n\nAttention : les places sont limitées, nous vous encourageons à réserver rapidement.\n\nCordialement,`,
                },
                {
                  label: "📋 Rappel général",
                  subject: "Rappel BIA — Votre espace parent",
                  body: `Bonjour,\n\nNous souhaitons vous rappeler que votre espace parent BIA Manager vous permet de :\n\n• Suivre l'avancement du dossier de votre enfant\n• Remplir et signer l'attestation parentale\n• Réserver un créneau de vol de découverte une fois le paiement et l'attestation validés\n\nPour toute question, n'hésitez pas à nous contacter directement.\n\nCordialement,`,
                },
              ].map(tpl => (
                <button
                  key={tpl.label}
                  type="button"
                  onClick={() => { setSubject(tpl.subject); setBody(tpl.body); }}
                  className="text-xs px-2.5 py-1 rounded-full border border-gray-200 text-gray-600 hover:border-brand-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                >
                  {tpl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Objet *</label>
              <input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Objet de l'email..."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Rédigez votre message ici..."
                rows={10}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none"
              />
              <p className="text-[11px] text-gray-400 mt-1">Les sauts de ligne seront convertis en retours à la ligne dans l'email.</p>
            </div>
          </div>

          {sendError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {sendError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ChevronLeft className="w-4 h-4" /> Retour
            </button>
            <button
              onClick={handleSend}
              disabled={sending || !subject.trim() || !body.trim()}
              className="flex items-center gap-2 btn-primary btn-sm disabled:opacity-40"
            >
              {sending ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Envoi...</>
              ) : (
                <><Send className="w-4 h-4" /> Envoyer {recipients.length} email{recipients.length > 1 ? "s" : ""}</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Result ── */}
      {step === 3 && result && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900 text-lg">{result.sent} email{result.sent > 1 ? "s" : ""} envoyé{result.sent > 1 ? "s" : ""} !</h2>
            <p className="text-sm text-gray-500 mt-1">Tous les destinataires ont été notifiés.</p>
          </div>
          {result.errors && result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5 text-sm text-amber-700 text-left">
              <p className="font-medium mb-1">{result.errors.length} erreur{result.errors.length > 1 ? "s" : ""} :</p>
              {result.errors.map((e, i) => <p key={i} className="text-xs">{e}</p>)}
            </div>
          )}
          <button onClick={reset} className="btn-primary btn-sm mx-auto">
            Envoyer un autre email
          </button>
        </div>
      )}
    </div>
  );
}
