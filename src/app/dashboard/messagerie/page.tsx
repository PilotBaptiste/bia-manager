"use client";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Mail, Users, School, X, Send, ChevronRight, ChevronLeft, Check, AlertCircle, Search } from "lucide-react";

const supabase = createClient();

export default function MessageriePage() {
  const [etablissements, setEtablissements] = useState<any[]>([]);
  const [eleves, setEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Step management
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — recipients
  const [mode, setMode] = useState<"etab" | "eleve">("etab");
  const [selectedEtabs, setSelectedEtabs] = useState<string[]>([]);
  const [selectedEleves, setSelectedEleves] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filterEtabEleve, setFilterEtabEleve] = useState<string>(""); // filter élèves list by étab

  // Step 2 — compose
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  // Step 3 — send
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; errors?: string[] } | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [senderEmail, setSenderEmail] = useState<string>("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) setSenderEmail(user.email);
      const [{ data: etabs }, { data: elevesData }] = await Promise.all([
        supabase.from("etablissements").select("id, nom").order("nom"),
        supabase.from("eleves")
          .select("id, prenom, nom, parent_email, parent_prenom, etablissement_id, archive")
          .eq("archive", false)
          .not("parent_email", "is", null)
          .order("nom"),
      ]);
      setEtablissements(etabs ?? []);
      setEleves(elevesData ?? []);
      setLoading(false);
    }
    load();
  }, []);

  // Compute recipients from selection
  const recipients = useMemo(() => {
    const list: { email: string; eleve_prenom: string; eleve_nom: string; etab_id: string; eleve_id: string }[] = [];
    const seen = new Set<string>();
    if (mode === "etab") {
      for (const e of eleves) {
        if (!selectedEtabs.includes(e.etablissement_id)) continue;
        if (!e.parent_email) continue;
        if (seen.has(e.parent_email)) continue;
        seen.add(e.parent_email);
        list.push({ email: e.parent_email, eleve_prenom: e.prenom, eleve_nom: e.nom, etab_id: e.etablissement_id, eleve_id: e.id });
      }
    } else {
      for (const e of eleves) {
        if (!selectedEleves.includes(e.id)) continue;
        if (!e.parent_email) continue;
        if (seen.has(e.parent_email)) continue;
        seen.add(e.parent_email);
        list.push({ email: e.parent_email, eleve_prenom: e.prenom, eleve_nom: e.nom, etab_id: e.etablissement_id, eleve_id: e.id });
      }
    }
    return list;
  }, [mode, selectedEtabs, selectedEleves, eleves]);

  const filteredEleves = useMemo(() => {
    const q = search.toLowerCase();
    return eleves.filter(e => {
      if (filterEtabEleve && e.etablissement_id !== filterEtabEleve) return false;
      if (q && !`${e.prenom} ${e.nom} ${e.parent_email}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [eleves, search, filterEtabEleve]);

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
      {/* Header */}
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
          <div className="flex gap-2">
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
          </div>

          {mode === "etab" && (
            <div className="space-y-2">
              <p className="text-xs text-gray-400">Sélectionnez un ou plusieurs établissements (tous les parents liés recevront l'email) :</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {etablissements.map(etab => {
                  const count = eleves.filter(e => e.etablissement_id === etab.id && e.parent_email).length;
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
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {filteredEleves.map(e => {
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

          {/* Recipients summary */}
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
