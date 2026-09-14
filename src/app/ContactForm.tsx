"use client";
import { useState } from "react";
import { CheckCircle, Loader2, Send } from "lucide-react";

const empty = { nom: "", aeroclub: "", email: "", telephone: "", message: "", website: "" };

export default function ContactForm() {
  const [form, setForm] = useState(empty);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setError(data.error ?? "L'envoi a échoué. Réessayez dans quelques minutes.");
      return;
    }
    setSent(true);
    setForm(empty);
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-5">
        <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-emerald-800">Message envoyé</p>
          <p className="text-sm text-emerald-700 mt-0.5">Merci ! Nous revenons vers vous rapidement par email.</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="c-nom">Nom et prénom</label>
          <input id="c-nom" className="input" value={form.nom} onChange={set("nom")} required autoComplete="name" />
        </div>
        <div>
          <label className="label" htmlFor="c-club">Aéroclub</label>
          <input id="c-club" className="input" value={form.aeroclub} onChange={set("aeroclub")} required placeholder="Aéroclub de…" />
        </div>
        <div>
          <label className="label" htmlFor="c-email">Email</label>
          <input id="c-email" type="email" className="input" value={form.email} onChange={set("email")} required autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="c-tel">Téléphone <span className="normal-case font-normal text-gray-400">(facultatif)</span></label>
          <input id="c-tel" type="tel" className="input" value={form.telephone} onChange={set("telephone")} autoComplete="tel" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="c-msg">Votre besoin</label>
        <textarea id="c-msg" className="input min-h-[120px]" value={form.message} onChange={set("message")} required placeholder="Nombre d'établissements, d'élèves par an, questions…" />
      </div>
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={set("website")} name="website" />
      <button type="submit" disabled={sending} className="btn-primary w-full sm:w-auto justify-center">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Envoyer la demande
      </button>
    </form>
  );
}
