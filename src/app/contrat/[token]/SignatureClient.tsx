"use client";
import { useCallback, useEffect, useState } from "react";
import { Plane, Loader2, Check, AlertCircle, Mail, ShieldCheck, Printer } from "lucide-react";

type Donnees = {
  titre: string;
  club: string;
  representant: string;
  fonction: string;
  email_masque: string;
  deja_signe: boolean;
  signature: { nom: string; le: string; reference: string } | null;
  code_envoye: boolean;
  bloque: boolean;
  document: string;
};

/**
 * Signature d'un contrat par le représentant d'un aéroclub, sans compte.
 * Le contrat est lu en entier avant toute saisie : on ne fait pas signer
 * quelqu'un qui n'a pas pu voir ce qu'il signe.
 */
export default function SignatureClient({ token }: { token: string }) {
  const [donnees, setDonnees] = useState<Donnees | null>(null);
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [etape, setEtape] = useState<"lecture" | "code" | "fini">("lecture");
  const [code, setCode] = useState("");
  const [nom, setNom] = useState("");
  const [lu, setLu] = useState(false);
  const [habilite, setHabilite] = useState(false);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [resultat, setResultat] = useState<{ reference: string; horodatage: string } | null>(null);

  const charger = useCallback(async () => {
    const res = await fetch(`/api/contrats/signer?token=${encodeURIComponent(token)}`);
    const json = await res.json();
    if (!res.ok) { setErreurChargement(json.error ?? "Lien invalide"); return; }
    setDonnees(json);
    setNom(json.representant ?? "");
    if (json.deja_signe) setEtape("fini");
  }, [token]);

  useEffect(() => { charger(); }, [charger]);

  async function demanderCode() {
    setOccupe(true);
    setErreur(null);
    const res = await fetch("/api/contrats/signer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "code" }),
    });
    const json = await res.json();
    setOccupe(false);
    if (!res.ok) { setErreur(json.error ?? "Envoi impossible"); return; }
    setEtape("code");
  }

  async function signer() {
    setOccupe(true);
    setErreur(null);
    const res = await fetch("/api/contrats/signer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, action: "signer", code, nom }),
    });
    const json = await res.json();
    setOccupe(false);
    if (!res.ok) { setErreur(json.error ?? "Signature impossible"); return; }
    setResultat({ reference: json.reference, horodatage: json.horodatage });
    setEtape("fini");
  }

  function imprimer() {
    if (!donnees) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(donnees.document);
    w.document.close();
    w.focus();
  }

  if (erreurChargement) {
    return (
      <Coquille>
        <div className="card text-center py-12">
          <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-800">{erreurChargement}</p>
          <p className="text-xs text-gray-500 mt-2">
            Contactez l&apos;éditeur de BIA Manager pour recevoir un nouveau lien.
          </p>
        </div>
      </Coquille>
    );
  }

  if (!donnees) {
    return (
      <Coquille>
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-400" /></div>
      </Coquille>
    );
  }

  if (etape === "fini") {
    const ref = resultat?.reference ?? donnees.signature?.reference;
    const quand = resultat?.horodatage ?? donnees.signature?.le;
    return (
      <Coquille>
        <div className="card text-center py-10">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-emerald-600" />
          </div>
          <h2 className="font-bold text-gray-900">Contrat signé</h2>
          <p className="text-sm text-gray-600 mt-2">
            Signé par <strong>{resultat ? nom : donnees.signature?.nom}</strong>
            {quand ? ` le ${new Date(quand).toLocaleDateString("fr-FR")}` : ""}.
          </p>
          {ref && <p className="text-xs text-gray-400 mt-1">Référence {ref}</p>}
          <p className="text-sm text-gray-500 mt-4">
            Un exemplaire signé vient de vous être envoyé par email. Conservez-le.
          </p>
          <button onClick={imprimer} className="btn-secondary btn-sm mx-auto mt-5">
            <Printer className="w-3.5 h-3.5" /> Relire le contrat
          </button>
        </div>
      </Coquille>
    );
  }

  return (
    <Coquille>
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900">{donnees.titre}</h1>
        <p className="text-sm text-gray-500 mt-0.5">{donnees.club}</p>
      </div>

      {/* Le contrat en entier, avant toute saisie. */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden mb-4">
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-100 bg-gray-50/60">
          <p className="text-xs font-semibold text-gray-600">Le contrat</p>
          <button onClick={imprimer} className="btn-secondary btn-sm">
            <Printer className="w-3.5 h-3.5" /> Ouvrir en grand
          </button>
        </div>
        <iframe
          title="Contrat"
          srcDoc={donnees.document}
          className="w-full h-[55vh] bg-white"
          sandbox=""
        />
      </div>

      <div className="card">
        {etape === "lecture" ? (
          <>
            <label className="flex items-start gap-2.5 cursor-pointer mb-3">
              <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-gray-700">J&apos;ai lu l&apos;intégralité du contrat ci-dessus.</span>
            </label>
            <label className="flex items-start gap-2.5 cursor-pointer mb-4">
              <input type="checkbox" checked={habilite} onChange={(e) => setHabilite(e.target.checked)} className="mt-0.5" />
              <span className="text-sm text-gray-700">
                Je certifie être habilité à engager {donnees.club}
                {donnees.fonction ? ` en qualité de ${donnees.fonction}` : ""}.
              </span>
            </label>

            <div className="p-3 rounded-lg bg-brand-50/60 border border-brand-100 flex items-start gap-2 mb-4">
              <ShieldCheck className="w-4 h-4 text-brand-500 shrink-0 mt-0.5" />
              <p className="text-xs text-brand-800">
                Un code à 6 chiffres va être envoyé à <strong>{donnees.email_masque}</strong>. C&apos;est lui qui
                atteste que la signature vient bien de vous.
              </p>
            </div>

            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}

            <button onClick={demanderCode} disabled={!lu || !habilite || occupe} className="btn-primary w-full">
              {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Recevoir mon code de signature
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-4">
              Un code vient d&apos;être envoyé à <strong>{donnees.email_masque}</strong>.
            </p>

            <label className="label">Code à 6 chiffres</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              className="input text-center text-2xl tracking-[0.5em] font-semibold mb-4"
            />

            <label className="label">Votre nom, tel qu&apos;il figure au contrat</label>
            <input value={nom} onChange={(e) => setNom(e.target.value)} className="input mb-1" />
            {donnees.representant && (
              <p className="text-[11px] text-gray-400 mb-4">
                Tapez exactement : <strong>{donnees.representant}</strong>
              </p>
            )}

            {erreur && <p className="text-sm text-red-600 mb-3">{erreur}</p>}

            <button onClick={signer} disabled={code.length !== 6 || !nom.trim() || occupe} className="btn-primary w-full">
              {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Signer le contrat
            </button>
            <button onClick={demanderCode} disabled={occupe} className="text-xs text-gray-400 hover:text-brand-500 mt-3 w-full text-center">
              Je n&apos;ai rien reçu — renvoyer un code
            </button>
            <p className="text-[11px] text-gray-400 mt-4 text-center">
              Signature électronique au sens des articles 1366 et 1367 du Code civil.
            </p>
          </>
        )}
      </div>
    </Coquille>
  );
}

function Coquille({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-4 flex items-center gap-2">
          <Plane className="w-4 h-4 text-brand-500" />
          <span className="text-sm font-bold text-brand-600">BIA Manager</span>
        </div>
      </header>
      <main className="max-w-[820px] mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
