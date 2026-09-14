import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// Map Resend webhook event types → our status labels
const EVENT_MAP: Record<string, string> = {
  "email.sent": "envoye",
  "email.delivered": "delivre",
  "email.delivery_delayed": "retarde",
  "email.complained": "spam",
  "email.bounced": "rebondi",
  "email.opened": "ouvert",
  "email.clicked": "clique",
};

// Svix signature scheme used by Resend webhooks.
function verifySignature(req: Request, payload: string, secret: string) {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signatures = req.headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return signatures.split(" ").some((part) => {
    const sig = part.split(",")[1];
    return !!sig && sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  });
}

export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[webhook/email] RESEND_WEBHOOK_SECRET manquant");
    return NextResponse.json({ error: "Webhook non configuré" }, { status: 500 });
  }
  const payload = await req.text();
  if (!verifySignature(req, payload, secret)) {
    return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
  }
  try {
    const body = JSON.parse(payload);
    const eventType: string = body?.type ?? "";
    const emailId: string = body?.data?.email_id ?? "";

    if (!emailId || !EVENT_MAP[eventType]) {
      return NextResponse.json({ ignored: true });
    }

    const statut = EVENT_MAP[eventType];

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    await supabase
      .from("email_logs")
      .update({ statut, updated_at: new Date().toISOString() })
      .eq("resend_id", emailId);

    return NextResponse.json({ ok: true, statut });
  } catch (e: any) {
    console.error("[webhook/email]", e);
    return NextResponse.json({ error: e?.message }, { status: 500 });
  }
}
