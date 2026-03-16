import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const body = await req.json();
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
