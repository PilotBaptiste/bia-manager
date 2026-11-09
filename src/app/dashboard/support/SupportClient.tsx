"use client";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { MessageCircle, Smartphone, ExternalLink, Mail, Phone, LifeBuoy, Send, Loader2, CheckCircle, Building2 } from "lucide-react";
import { useClub } from "@/contexts/ClubContext";

/** Formulaire de contact de l'équipe BIA Manager, réservé aux responsables du club. */
function ContactPlateforme({ clubNom }: { clubNom: string }) {
  const [sujet, setSujet] = useState("");
  const [message, setMessage] = useState("");
  const [urgence, setUrgence] = useState("normale");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sujet, message, urgence }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "L'envoi a échoué. Réessayez dans quelques minutes.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="card">
        <div className="flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Message envoyé à l&apos;équipe BIA Manager</p>
            <p className="text-sm text-gray-600 mt-0.5">
              Nous vous répondons par email à l&apos;adresse de votre compte.
            </p>
            <button onClick={() => { setSent(false); setSujet(""); setMessage(""); }} className="btn-secondary btn-sm mt-3">
              Écrire un autre message
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
        <LifeBuoy className="w-4 h-4 text-brand-400" /> Contacter l&apos;équipe BIA Manager
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Un bug, une question sur la plateforme, un besoin d&apos;évolution ? Écrivez-nous directement.
        Votre nom, votre email et le club ({clubNom}) sont joints automatiquement.
      </p>
      <form onSubmit={submit} className="space-y-3">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
        <div>
          <label className="label" htmlFor="s-sujet">Sujet</label>
          <input id="s-sujet" className="input" value={sujet} onChange={(e) => setSujet(e.target.value)} required
            placeholder="Ex. : les emails de rappel ne partent pas" />
        </div>
        <div>
          <label className="label" htmlFor="s-urgence">Niveau</label>
          <select id="s-urgence" className="select" value={urgence} onChange={(e) => setUrgence(e.target.value)}>
            <option value="normale">Question ou demande d&apos;évolution</option>
            <option value="haute">Problème gênant mais contournable</option>
            <option value="bloquante">Blocage : le club ne peut plus travailler</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="s-msg">Message</label>
          <textarea id="s-msg" className="input min-h-[140px]" value={message} onChange={(e) => setMessage(e.target.value)} required
            placeholder="Décrivez ce que vous faisiez, ce que vous attendiez et ce qui s'est passé." />
        </div>
        <button type="submit" disabled={sending} className="btn-primary w-full sm:w-auto justify-center">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer à BIA Manager
        </button>
      </form>
    </div>
  );
}

export default function SupportClient({ estResponsable }: { estResponsable?: boolean }) {
  const club = useClub();
  const WHATSAPP_URL = club.whatsapp
    ? `https://wa.me/${club.whatsapp}?text=Bonjour%2C%20j%27ai%20besoin%20d%27aide.`
    : "";
  const emailContact = club.emailSupport || club.email;
  const telContact = club.telephoneSupport || club.telephone;
  const aucunContact = !WHATSAPP_URL && !emailContact && !telContact;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Support</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {estResponsable ? "Contacts de votre club et assistance BIA Manager" : "Contactez votre aéroclub en cas de problème"}
        </p>
      </div>

      <div className="max-w-lg space-y-4">
        {/* ── Contact du club, pour les familles ── */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-brand-400" /> {club.nom}
          </h2>
          {club.messageSupport ? (
            <p className="text-sm text-gray-600 whitespace-pre-line mb-4">{club.messageSupport}</p>
          ) : (
            <p className="text-sm text-gray-500 mb-4">
              {aucunContact
                ? "Votre aéroclub n'a pas encore renseigné de contact ici."
                : "L'équipe de l'aéroclub est à votre disposition pour toute question sur les vols BIA."}
            </p>
          )}

          <div className="space-y-2">
            {emailContact && (
              <a href={`mailto:${emailContact}`} className="flex items-center gap-2 text-sm text-brand-500 hover:underline">
                <Mail className="w-4 h-4 shrink-0" /> {emailContact}
              </a>
            )}
            {telContact && (
              <a href={`tel:${telContact.replace(/\s/g, "")}`} className="flex items-center gap-2 text-sm text-gray-700 hover:underline">
                <Phone className="w-4 h-4 shrink-0 text-gray-400" /> {telContact}
              </a>
            )}
          </div>
        </div>

        {/* ── WhatsApp du club ── */}
        {WHATSAPP_URL && (
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: "#25D366" }}>
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
            </div>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Écrire sur WhatsApp</h2>
            <p className="text-sm text-gray-500 mb-6">
              Le moyen le plus rapide de joindre l&apos;aéroclub.
            </p>

            <div className="flex justify-center mb-4">
              <div className="p-4 bg-white rounded-2xl border-2 border-gray-100 shadow-sm inline-block">
                <QRCodeSVG value={WHATSAPP_URL} size={180} fgColor="#1b3a5c" bgColor="#ffffff" level="M" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-6">
              <Smartphone className="w-4 h-4 flex-shrink-0" />
              <span>Scannez avec votre téléphone pour ouvrir WhatsApp</span>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">ou</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full justify-center"
              style={{ backgroundColor: "#25D366", borderColor: "#25D366" }}
            >
              <MessageCircle className="w-4 h-4" />
              Ouvrir WhatsApp directement
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </a>
          </div>
        )}

        <div className="card bg-blue-50 border-blue-100">
          <p className="text-sm text-blue-800 font-medium mb-1">Avant de nous contacter</p>
          <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
            <li>Précisez votre nom et l&apos;établissement de votre enfant</li>
            <li>Décrivez le problème rencontré</li>
            <li>Indiquez si possible une capture d&apos;écran</li>
          </ul>
        </div>

        {/* ── Assistance de la plateforme, réservée aux responsables du club ── */}
        {estResponsable && <ContactPlateforme clubNom={club.nom} />}
      </div>
    </div>
  );
}
