import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

const FROM =
  process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";

function wrap(inner: string, contact?: { nom?: string; email?: string; telephone?: string }) {
  const contactLines = [];
  if (contact?.telephone) contactLines.push(`📞 ${contact.telephone}`);
  if (contact?.email) contactLines.push(`✉️ <a href="mailto:${contact.email}" style="color:#1b3a5c">${contact.email}</a>`);
  const contactBlock = contact?.nom || contactLines.length > 0 ? `
    <div style="margin-top:20px;padding:14px 16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;color:#64748b">
      <p style="margin:0 0 4px;font-weight:700;color:#1b3a5c">${contact?.nom || "Aéro-Club"}</p>
      ${contactLines.map(l => `<p style="margin:2px 0">${l}</p>`).join("")}
    </div>` : "";
  return `<div style="font-family:system-ui,'DM Sans',sans-serif;background:#f1f5f9;padding:40px 16px;min-height:100vh">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:#1b3a5c;border-radius:12px 12px 0 0;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <span style="color:#fff;font-weight:800;font-size:15px;letter-spacing:.3px">✈ BIA Manager</span>
      <span style="color:#7b9fd1;font-size:13px">— ${contact?.nom || "Aéro-Club du Bassin d'Arcachon"}</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;padding:32px 28px">
      ${inner}
      ${contactBlock}
      <div style="margin-top:24px;padding-top:16px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;text-align:center">
        <a href="${APP_URL}" style="color:#1b3a5c;font-weight:600;text-decoration:none">Accéder à la plateforme</a>
        &nbsp;·&nbsp; ${contact?.nom || "Aéro-Club du Bassin d'Arcachon"}
      </div>
    </div>
  </div>
</div>`;
}

function badge(label: string, color: string) {
  return `<span style="display:inline-block;background:${color};padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700">${label}</span>`;
}

function infoBox(rows: { label: string; value: string }[]) {
  const cells = rows
    .map(
      (r) =>
        `<tr><td style="padding:8px 12px;color:#64748b;font-size:13px;white-space:nowrap">${r.label}</td>
          <td style="padding:8px 12px;color:#0f172a;font-size:13px;font-weight:600">${r.value}</td></tr>`,
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin:16px 0"><tbody>${cells}</tbody></table>`;
}

function ctaBtn(label: string, url: string) {
  return `<div style="text-align:center;margin:24px 0">
    <a href="${url}" style="display:inline-block;background:#1b3a5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">${label} →</a>
  </div>`;
}

function makeICS(params: {
  uid: string;
  date_vol: string;
  heure_debut: string;
  heure_fin: string;
  summary: string;
  description: string;
}): string {
  // Convert "2026-04-15" + "09:30" → "20260415T093000"
  const toIcsDt = (date: string, time: string) =>
    date.replace(/-/g, "") + "T" + time.replace(":", "").slice(0, 4) + "00";
  const dtstart = toIcsDt(params.date_vol, params.heure_debut);
  const dtend = toIcsDt(params.date_vol, params.heure_fin);
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  // Escape special chars in ICS
  const esc = (s: string) => s.replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BIA Manager//Vol BIA//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${params.uid}@bia-manager`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `SUMMARY:${esc(params.summary)}`,
    `DESCRIPTION:${esc(params.description)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

function fmt(date: string) {
  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return date;
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.RESEND_API_KEY) {
      // Silently succeed in dev without RESEND configured
      return NextResponse.json({ success: true, dev: true });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);
    const body = await req.json();
    const { type } = body;

    // Fetch aéroclub contact info from parametres table
    const supabaseAdmin = adminSupabase();
    let contact: { nom?: string; email?: string; telephone?: string } = {};
    if (supabaseAdmin) {
      const { data: params } = await supabaseAdmin.from("parametres").select("cle, valeur");
      if (params) {
        const p: Record<string, string> = {};
        for (const row of params) p[row.cle] = row.valeur;
        contact = {
          nom: p["nom_aeroclub"] || undefined,
          email: p["email_aeroclub"] || undefined,
          telephone: p["telephone_aeroclub"] || undefined,
        };
      }
    }

    const emails: { to: string; subject: string; html: string; eleve_id?: string | null; attachments?: { filename: string; content: string }[] }[] = [];

    // ─────────────────────────────────────────────────
    // BOOKING CONFIRMED — parent reserves a slot
    // ─────────────────────────────────────────────────
    if (type === "booking_confirm") {
      const {
        parent_email,
        parent_prenom,
        eleve_prenom,
        eleve_nom,
        type_vol,
        date_vol,
        heure_debut,
        heure_fin,
        aeronef,
        pilote_nom,
        pilote_email,
        pilote_telephone,
        etablissement,
      } = body;

      // Build ICS calendar attachment
      const icsContent = makeICS({
        uid: `booking-${parent_email}-${date_vol}-${heure_debut}`.replace(/[^a-zA-Z0-9-]/g, "-"),
        date_vol,
        heure_debut: heure_debut?.slice(0, 5) || "00:00",
        heure_fin: heure_fin?.slice(0, 5) || "00:00",
        summary: `Vol BIA ${type_vol} — ${eleve_prenom} ${eleve_nom}`,
        description: [
          pilote_nom ? `Pilote : ${pilote_nom}` : "",
          pilote_telephone ? `Tél. pilote : ${pilote_telephone}` : "",
          aeronef ? `Aéronef : ${aeronef}` : "",
          etablissement ? `Établissement : ${etablissement}` : "",
        ].filter(Boolean).join("\n"),
      });
      const icsAttachment = { filename: `vol-bia-${date_vol}.ics`, content: Buffer.from(icsContent).toString("base64") };

      // To parent — confirmation
      emails.push({
        to: parent_email,
        subject: `✅ Réservation confirmée — Vol ${type_vol} du ${fmt(date_vol)}`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Réservation confirmée !</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${parent_prenom},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 8px">
            La réservation de <strong>${eleve_prenom} ${eleve_nom}</strong> pour le <strong>Vol ${type_vol}</strong> a bien été enregistrée.
          </p>
          ${infoBox([
            { label: "📅 Date", value: fmt(date_vol) },
            { label: "⏰ Horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
            { label: "✈️ Appareil", value: aeronef || "—" },
            { label: "👨‍✈️ Pilote", value: pilote_nom || "—" },
            ...(pilote_telephone ? [{ label: "📞 Téléphone", value: pilote_telephone }] : []),
            ...(pilote_email ? [{ label: "📧 Pilote", value: pilote_email }] : []),
            ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
          ])}
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0">
            <p style="margin:0;color:#1e40af;font-size:13px;font-weight:700">📍 Lieu du vol</p>
            <p style="margin:6px 0 0;color:#1d4ed8;font-size:13px">Aéro-Club du Bassin d'Arcachon<br>Aérodrome de Villemarie<br>33260 La Teste de Buch</p>
            <p style="margin:10px 0 0;color:#1e40af;font-size:13px;font-weight:700">⏰ Merci de vous présenter <strong>15 minutes avant</strong> l'heure prévue du vol.</p>
          </div>
          <p style="color:#64748b;font-size:13px">📎 Un fichier <strong>.ics</strong> est joint à cet email — ouvrez-le pour ajouter le vol à votre calendrier (Apple, Google, Outlook…).</p>
          <p style="color:#64748b;font-size:13px">En cas d'empêchement, annulez la réservation au moins <strong>48h avant</strong> le vol depuis votre espace.</p>
          ${ctaBtn("Voir mes réservations", `${APP_URL}/dashboard/reservation`)}
        `, contact),
        attachments: [icsAttachment],
      });

      // To pilot — new booking notification (skip if same address as parent)
      if (pilote_email && pilote_email !== parent_email) {
        emails.push({
          to: pilote_email,
          subject: `🆕 Nouvelle réservation — ${eleve_prenom} ${eleve_nom} · Vol ${type_vol} · ${fmt(date_vol)}`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Nouvelle réservation</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Un parent vient de réserver pour votre créneau.</p>
            ${infoBox([
              { label: "👦 Élève", value: `${eleve_prenom} ${eleve_nom}` },
              { label: "🎫 Type de vol", value: `Vol ${type_vol}` },
              { label: "📅 Date", value: fmt(date_vol) },
              { label: "⏰ Horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
              ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
            ])}
            ${ctaBtn("Voir le planning", `${APP_URL}/dashboard/vols`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // BOOKING CANCELLED — parent cancels
    // ─────────────────────────────────────────────────
    else if (type === "booking_cancel") {
      const {
        parent_email,
        parent_prenom,
        eleve_prenom,
        eleve_nom,
        type_vol,
        date_vol,
        heure_debut,
        pilote_email,
        pilote_nom,
        motif,
      } = body;

      // To parent — confirmation
      emails.push({
        to: parent_email,
        subject: `❌ Annulation confirmée — Vol ${type_vol} du ${fmt(date_vol)}`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Annulation enregistrée</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${parent_prenom},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            La réservation de <strong>${eleve_prenom} ${eleve_nom}</strong> pour le <strong>Vol ${type_vol}</strong> a été annulée par le pilote.
          </p>
          ${infoBox([
            { label: "📅 Date annulée", value: fmt(date_vol) },
            { label: "⏰ Horaire", value: heure_debut?.slice(0, 5) || "—" },
            ...(motif ? [{ label: "💬 Motif", value: motif }] : []),
          ])}
          <p style="color:#64748b;font-size:13px">Vous pouvez réserver un autre créneau disponible depuis votre espace.</p>
          ${ctaBtn("Réserver un nouveau créneau", `${APP_URL}/dashboard/reservation`)}
        `, contact),
      });

      // To pilot — cancellation notification (skip if same address as parent)
      if (pilote_email && pilote_email !== parent_email) {
        emails.push({
          to: pilote_email,
          subject: `⚠️ Annulation de réservation — ${eleve_prenom} ${eleve_nom} · ${fmt(date_vol)}`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Réservation annulée</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Un parent a annulé sa réservation.</p>
            ${infoBox([
              { label: "👦 Élève", value: `${eleve_prenom} ${eleve_nom}` },
              { label: "🎫 Type de vol", value: `Vol ${type_vol}` },
              { label: "📅 Date", value: fmt(date_vol) },
              { label: "⏰ Horaire", value: heure_debut?.slice(0, 5) || "—" },
            ])}
            ${ctaBtn("Voir le planning", `${APP_URL}/dashboard/vols`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // SLOT MODIFIED — pilot edits a slot with bookings
    // ─────────────────────────────────────────────────
    else if (type === "slot_modified") {
      const {
        parents,
        date_vol,
        heure_debut,
        heure_fin,
        aeronef,
        etablissement,
      } = body;
      // parents: [{email, prenom, eleve_prenom, eleve_nom}]
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `⚠️ Modification de votre créneau — ${fmt(date_vol)}`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Créneau modifié</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 8px">
              Le créneau de vol de <strong>${p.eleve_prenom} ${p.eleve_nom}</strong> a été modifié par le pilote. Voici les nouveaux détails :
            </p>
            ${infoBox([
              { label: "📅 Nouvelle date", value: fmt(date_vol) },
              { label: "⏰ Nouvel horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
              ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
              ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
            ])}
            <p style="color:#64748b;font-size:13px">Si ces modifications ne vous conviennent pas, vous pouvez annuler et choisir un autre créneau depuis votre espace.</p>
            ${ctaBtn("Voir mes réservations", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // SLOT CANCELLED — pilot cancels a slot
    // ─────────────────────────────────────────────────
    else if (type === "slot_cancelled") {
      const { parents, date_vol, heure_debut, pilote_nom, pilote_email, pilote_telephone, motif } = body;
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `❌ Créneau annulé — Vol du ${fmt(date_vol)}`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#ef4444">Créneau annulé</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 8px">
              Nous vous informons que le créneau de vol prévu pour <strong>${p.eleve_prenom} ${p.eleve_nom}</strong> a été <strong>annulé</strong>.
            </p>
            ${infoBox([
              { label: "📅 Date", value: fmt(date_vol) },
              { label: "⏰ Horaire", value: heure_debut?.slice(0, 5) || "—" },
              ...(pilote_nom ? [{ label: "👨‍✈️ Pilote", value: pilote_nom }] : []),
              ...(motif ? [{ label: "💬 Motif", value: motif }] : []),
            ])}
            ${(pilote_email || pilote_telephone) ? `
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:16px 0">
              <p style="margin:0;color:#92400e;font-size:13px;font-weight:700">📞 Coordonnées du pilote en cas de question</p>
              ${pilote_nom ? `<p style="margin:6px 0 0;color:#78350f;font-size:13px;font-weight:600">${pilote_nom}</p>` : ""}
              ${pilote_telephone ? `<p style="margin:4px 0 0;color:#78350f;font-size:13px">📱 ${pilote_telephone}</p>` : ""}
              ${pilote_email ? `<p style="margin:4px 0 0;color:#78350f;font-size:13px">✉️ <a href="mailto:${pilote_email}" style="color:#78350f">${pilote_email}</a></p>` : ""}
            </div>` : ""}
            <p style="color:#64748b;font-size:13px">Vous pouvez réserver un nouveau créneau disponible depuis votre espace dès maintenant.</p>
            ${ctaBtn("Réserver un nouveau créneau", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // SLOT AVAILABLE — new créneau created, notify parents
    // ─────────────────────────────────────────────────
    else if (type === "slot_available") {
      const { parents, date_vol, heure_debut, heure_fin, pilote_nom, aeronef } = body;
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `✈️ Un créneau de vol est disponible pour ${p.eleve_prenom} !`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Un créneau de vol est disponible !</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 8px">
              Un nouveau créneau de vol de découverte vient d'être ouvert pour <strong>${p.eleve_prenom} ${p.eleve_nom}</strong>. Vous pouvez dès maintenant réserver votre place !
            </p>
            ${infoBox([
              { label: "📅 Date", value: date_vol },
              { label: "⏰ Horaire", value: `${heure_debut} – ${heure_fin}` },
              ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
              ...(pilote_nom ? [{ label: "👨‍✈️ Pilote", value: pilote_nom }] : []),
            ])}
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0">
              <p style="margin:0;color:#1e40af;font-size:13px;font-weight:600">💺 Il y a de la place pour tout le monde</p>
              <p style="margin:6px 0 0;color:#1d4ed8;font-size:13px">Ne tardez pas à réserver, les créneaux se remplissent vite. Si celui-ci est déjà complet, d'autres seront ouverts prochainement.</p>
            </div>
            ${ctaBtn("Réserver ce créneau", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // SLOT REMINDER — créneau toujours disponible
    // ─────────────────────────────────────────────────
    else if (type === "slot_reminder") {
      const { parents, date_vol, heure_debut, heure_fin, pilote_nom, aeronef } = body;
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `⏰ Rappel — un créneau de vol est toujours disponible pour ${p.eleve_prenom} !`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Le créneau est toujours disponible !</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 8px">
              Il reste des places sur le créneau de vol de découverte pour <strong>${p.eleve_prenom} ${p.eleve_nom}</strong>. N'attendez pas pour réserver !
            </p>
            ${infoBox([
              { label: "📅 Date", value: date_vol },
              { label: "⏰ Horaire", value: `${heure_debut} – ${heure_fin}` },
              ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
              ...(pilote_nom ? [{ label: "👨‍✈️ Pilote", value: pilote_nom }] : []),
            ])}
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:16px 0">
              <p style="margin:0;color:#92400e;font-size:13px;font-weight:600">⚡ Il reste des places — réservez maintenant</p>
              <p style="margin:6px 0 0;color:#b45309;font-size:13px">Ce créneau n'est pas encore complet. Réservez votre place avant qu'il ne le soit !</p>
            </div>
            ${ctaBtn("Réserver ce créneau", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // ATTESTATION + PAIEMENT READY — parent can book
    // ─────────────────────────────────────────────────
    else if (type === "attestation_ready") {
      const {
        parent_email,
        parent_prenom,
        eleve_prenom,
        eleve_nom,
        etablissement,
      } = body;

      emails.push({
        to: parent_email,
        subject: `🎉 ${eleve_prenom} peut réserver son vol !`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Votre enfant peut réserver son vol !</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${parent_prenom || ""},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            Bonne nouvelle — le paiement et l'attestation de <strong>${eleve_prenom} ${eleve_nom}</strong> ont été validés.
            Vous pouvez dès maintenant réserver le vol de découverte !
          </p>
          ${infoBox([
            { label: "👦 Élève", value: `${eleve_prenom} ${eleve_nom}` },
            ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
            { label: "✅ Paiement", value: "Confirmé" },
            { label: "📝 Attestation", value: "Signée" },
          ])}
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;margin:16px 0">
            <p style="margin:0;color:#15803d;font-size:13px;font-weight:600">🛫 Prochaine étape : réserver le créneau de vol</p>
          </div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin:16px 0">
            <p style="margin:0;color:#1e40af;font-size:13px;font-weight:600">💺 Il y a de la place pour tout le monde !</p>
            <p style="margin:6px 0 0;color:#1d4ed8;font-size:13px">Si aucun créneau n'est disponible pour le moment, <strong>ne vous inquiétez pas</strong> — de nouveaux créneaux seront ouverts prochainement et vous recevrez une notification dès qu'il y en aura un.</p>
          </div>
          ${ctaBtn("Réserver le vol maintenant", `${APP_URL}/dashboard/reservation`)}
        `, contact),
      });
    }

    // ─────────────────────────────────────────────────
    // NO SLOTS AVAILABLE — notify waiting parents
    // ─────────────────────────────────────────────────
    else if (type === "no_slots_available") {
      const { parents } = body; // [{email, prenom, eleve_prenom, eleve_nom, eleve_id}]
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `ℹ️ Plus de créneaux disponibles pour le moment`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Plus de créneaux disponibles</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 16px">
              Tous les créneaux de vol de découverte pour <strong>${p.eleve_prenom} ${p.eleve_nom}</strong> sont actuellement complets.
            </p>
            <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:14px 16px;margin:16px 0">
              <p style="margin:0;color:#92400e;font-size:13px;font-weight:600">⏳ Ne vous inquiétez pas !</p>
              <p style="margin:6px 0 0;color:#78350f;font-size:13px">De nouveaux créneaux seront ouverts prochainement. Vous recevrez un email dès qu'une place sera disponible.</p>
            </div>
            <p style="color:#64748b;font-size:13px">Vous pouvez vous connecter à tout moment pour vérifier la disponibilité.</p>
            ${ctaBtn("Vérifier les créneaux", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // PILOT CHANGED — email aux parents lors d'un swap
    // ─────────────────────────────────────────────────
    else if (type === "pilot_changed") {
      const { parents, date_vol, heure_debut, heure_fin, aeronef, etablissement, new_pilote_nom, new_pilote_email, new_pilote_telephone } = body;
      for (const p of parents || []) {
        emails.push({
          to: p.email,
          eleve_id: p.eleve_id ?? null,
          subject: `🔄 Changement de pilote — Vol de ${p.eleve_prenom} ${p.eleve_nom} du ${fmt(date_vol)}`,
          html: wrap(`
            <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Changement de pilote</h2>
            <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${p.prenom || ""},</p>
            <p style="color:#374151;font-size:14px;margin:0 0 8px">
              Le pilote assigné au vol de <strong>${p.eleve_prenom} ${p.eleve_nom}</strong> a été modifié.
              Votre réservation est maintenue, seul le pilote change.
            </p>
            ${infoBox([
              { label: "📅 Date", value: fmt(date_vol) },
              { label: "⏰ Horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
              ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
              { label: "👨‍✈️ Nouveau pilote", value: new_pilote_nom || "—" },
              ...(new_pilote_telephone ? [{ label: "📞 Téléphone", value: new_pilote_telephone }] : []),
              ...(new_pilote_email ? [{ label: "📧 Email", value: new_pilote_email }] : []),
              ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
            ])}
            <p style="color:#64748b;font-size:13px">En cas de question, n'hésitez pas à contacter directement votre nouveau pilote.</p>
            ${ctaBtn("Voir ma réservation", `${APP_URL}/dashboard/reservation`)}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // PILOT SWAP NEW — email au nouveau pilote avec infos élèves
    // ─────────────────────────────────────────────────
    else if (type === "pilot_swap_new") {
      const { pilote_email, pilote_prenom, date_vol, heure_debut, heure_fin, aeronef, etablissement, eleves_details, old_pilote_nom } = body;
      const elevesRows = (eleves_details || []).map((el: any) => [
        { label: "👦 Élève", value: `${el.prenom} ${el.nom} — Vol ${el.type_vol || "?"}` },
        ...(el.parent_nom || el.parent_prenom ? [{ label: "👨‍👩‍👦 Parent", value: `${el.parent_prenom || ""} ${el.parent_nom || ""}`.trim() }] : []),
        ...(el.parent_telephone ? [{ label: "📞 Tél. parent", value: el.parent_telephone }] : []),
        ...(el.parent_email ? [{ label: "📧 Email parent", value: el.parent_email }] : []),
      ]).flat();
      emails.push({
        to: pilote_email,
        subject: `✈️ Swap — Vous prenez en charge un créneau du ${fmt(date_vol)}`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Nouveau créneau à votre charge</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${pilote_prenom || ""},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 8px">
            Suite à un swap${old_pilote_nom ? ` avec <strong>${old_pilote_nom}</strong>` : ""}, vous prenez en charge le créneau suivant.
          </p>
          ${infoBox([
            { label: "📅 Date", value: fmt(date_vol) },
            { label: "⏰ Horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
            ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
            ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
          ])}
          <p style="margin:16px 0 8px;font-weight:700;font-size:14px;color:#0f172a">Élève${(eleves_details || []).length > 1 ? "s" : ""} à bord :</p>
          ${infoBox(elevesRows)}
          ${ctaBtn("Voir le planning", `${APP_URL}/dashboard/vols`)}
        `, contact),
      });
    }

    // ─────────────────────────────────────────────────
    // PILOT SWAP OLD — confirmation à l'ancien pilote
    // ─────────────────────────────────────────────────
    else if (type === "pilot_swap_old") {
      const { pilote_email, pilote_prenom, date_vol, heure_debut, heure_fin, aeronef, etablissement, new_pilote_nom, new_pilote_email, new_pilote_telephone, eleves_du_creneau } = body;
      emails.push({
        to: pilote_email,
        subject: `🔄 Swap confirmé — Créneau du ${fmt(date_vol)} transféré`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Swap confirmé</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${pilote_prenom || ""},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 8px">
            Votre créneau du <strong>${fmt(date_vol)}</strong> a été transféré à <strong>${new_pilote_nom || "un autre pilote"}</strong>.
            ${(eleves_du_creneau || []).length > 0 ? `Les élèves concernés (${(eleves_du_creneau as string[]).join(", ")}) ont été notifiés par email.` : ""}
          </p>
          ${infoBox([
            { label: "📅 Date", value: fmt(date_vol) },
            { label: "⏰ Horaire", value: `${heure_debut?.slice(0, 5)} – ${heure_fin?.slice(0, 5)}` },
            ...(aeronef ? [{ label: "✈️ Appareil", value: aeronef }] : []),
            ...(etablissement ? [{ label: "🏫 Établissement", value: etablissement }] : []),
            { label: "👨‍✈️ Nouveau pilote", value: new_pilote_nom || "—" },
            ...(new_pilote_telephone ? [{ label: "📞 Tél.", value: new_pilote_telephone }] : []),
            ...(new_pilote_email ? [{ label: "📧 Email", value: new_pilote_email }] : []),
          ])}
          ${ctaBtn("Voir le planning", `${APP_URL}/dashboard/vols`)}
        `, contact),
      });
    }

    // ─────────────────────────────────────────────────
    // CUSTOM — superadmin free-form email
    // ─────────────────────────────────────────────────
    else if (type === "custom") {
      const { recipients, subject: customSubject, body: customBody, sender_email } = body;
      const replyLine = sender_email
        ? `<p style="margin-top:20px;padding-top:16px;border-top:1px solid #f1f5f9;color:#64748b;font-size:13px">Si vous souhaitez nous répondre, merci de nous envoyer un mail à : <a href="mailto:${sender_email}" style="color:#1b3a5c;font-weight:600">${sender_email}</a></p>`
        : "";
      for (const r of recipients || []) {
        emails.push({
          to: r.email,
          eleve_id: r.eleve_id ?? null,
          subject: customSubject,
          html: wrap(`
            <div style="color:#374151;font-size:14px;line-height:1.7">${customBody.replace(/\n/g, "<br>")}</div>
            ${replyLine}
          `, contact),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // Unknown type
    // ─────────────────────────────────────────────────
    else {
      return NextResponse.json(
        { error: `Type d'email inconnu: ${type}` },
        { status: 400 },
      );
    }

    // Send all emails and log each one (reuse supabaseAdmin from above)
    const errors: string[] = [];

    for (const e of emails) {
      let resendId: string | null = null;
      let statut = "envoye";
      try {
        const result = await resend.emails.send({
          from: FROM,
          to: e.to,
          subject: e.subject,
          html: e.html,
          ...(e.attachments ? { attachments: e.attachments } : {}),
        });
        resendId = (result.data as any)?.id ?? null;
      } catch (err: any) {
        errors.push(err?.message ?? "Erreur envoi");
        statut = "erreur";
      }

      // Log to email_logs (best-effort, don't fail the request if logging fails)
      try {
        if (!supabaseAdmin) throw new Error("no supabase");
        await supabaseAdmin.from("email_logs").insert({
          type,
          to_email: e.to,
          subject: e.subject,
          eleve_id: e.eleve_id !== undefined ? e.eleve_id : (body.eleve_id ?? null),
          creneau_id: body.creneau_id ?? null,
          resend_id: resendId,
          statut,
        });
      } catch { /* ignore logging errors */ }
    }

    return NextResponse.json({
      success: true,
      sent: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    console.error("[/api/email]", e);
    return NextResponse.json(
      { error: e?.message ?? "Erreur serveur inattendue" },
      { status: 500 },
    );
  }
}
