import { Resend } from "resend";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function adminSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const FROM =
  process.env.RESEND_FROM ?? "BIA Manager <noreply@bia-manager-acba.vercel.app>";
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bia-manager-acba.vercel.app";

function wrap(inner: string) {
  return `<div style="font-family:system-ui,'DM Sans',sans-serif;background:#f1f5f9;padding:40px 16px;min-height:100vh">
  <div style="max-width:540px;margin:0 auto">
    <div style="background:#1b3a5c;border-radius:12px 12px 0 0;padding:20px 28px;display:flex;align-items:center;gap:10px">
      <span style="color:#fff;font-weight:800;font-size:15px;letter-spacing:.3px">✈ BIA Manager</span>
      <span style="color:#7b9fd1;font-size:13px">— Aéro-Club du Bassin d'Arcachon</span>
    </div>
    <div style="background:#fff;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;padding:32px 28px">
      ${inner}
      <div style="margin-top:32px;padding-top:20px;border-top:1px solid #f1f5f9;color:#94a3b8;font-size:12px;text-align:center">
        <a href="${APP_URL}" style="color:#1b3a5c;font-weight:600;text-decoration:none">Accéder à la plateforme</a>
        &nbsp;·&nbsp; Aéro-Club du Bassin d'Arcachon
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

    const emails: { to: string; subject: string; html: string }[] = [];

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
          <p style="color:#64748b;font-size:13px">En cas d'empêchement, annulez la réservation au moins <strong>48h avant</strong> le vol depuis votre espace.</p>
          ${ctaBtn("Voir mes réservations", `${APP_URL}/dashboard/reservation`)}
        `),
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
          `),
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
      } = body;

      // To parent — confirmation
      emails.push({
        to: parent_email,
        subject: `❌ Annulation confirmée — Vol ${type_vol} du ${fmt(date_vol)}`,
        html: wrap(`
          <h2 style="margin:0 0 4px;font-size:20px;color:#0f172a">Annulation enregistrée</h2>
          <p style="color:#64748b;margin:0 0 20px;font-size:14px">Bonjour ${parent_prenom},</p>
          <p style="color:#374151;font-size:14px;margin:0 0 16px">
            L'annulation de la réservation de <strong>${eleve_prenom} ${eleve_nom}</strong> pour le <strong>Vol ${type_vol}</strong> a bien été prise en compte.
          </p>
          ${infoBox([
            { label: "📅 Date annulée", value: fmt(date_vol) },
            { label: "⏰ Horaire", value: heure_debut?.slice(0, 5) || "—" },
          ])}
          <p style="color:#64748b;font-size:13px">Vous pouvez réserver un autre créneau disponible depuis votre espace.</p>
          ${ctaBtn("Réserver un nouveau créneau", `${APP_URL}/dashboard/reservation`)}
        `),
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
          `),
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
          `),
        });
      }
    }

    // ─────────────────────────────────────────────────
    // SLOT CANCELLED — pilot cancels a slot
    // ─────────────────────────────────────────────────
    else if (type === "slot_cancelled") {
      const { parents, date_vol, heure_debut, pilote_nom } = body;
      for (const p of parents || []) {
        emails.push({
          to: p.email,
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
            ])}
            <p style="color:#64748b;font-size:13px">Vous pouvez réserver un nouveau créneau disponible depuis votre espace dès maintenant.</p>
            ${ctaBtn("Réserver un nouveau créneau", `${APP_URL}/dashboard/reservation`)}
          `),
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
          ${ctaBtn("Réserver le vol maintenant", `${APP_URL}/dashboard/reservation`)}
        `),
      });
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

    // Send all emails and log each one
    const supabase = adminSupabase();
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
        });
        resendId = (result.data as any)?.id ?? null;
      } catch (err: any) {
        errors.push(err?.message ?? "Erreur envoi");
        statut = "erreur";
      }

      // Log to email_logs (best-effort, don't fail the request if logging fails)
      try {
        await supabase.from("email_logs").insert({
          type,
          to_email: e.to,
          subject: e.subject,
          eleve_id: body.eleve_id ?? null,
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
