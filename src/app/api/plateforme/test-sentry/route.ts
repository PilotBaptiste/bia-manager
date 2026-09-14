import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";

// Sends a harmless test error to Sentry so the owner can confirm alerts arrive.
export async function POST() {
  const auth = await requireRole(["proprietaire"], { allowNoOrg: true });
  if (auth instanceof NextResponse) return auth;
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) {
    return NextResponse.json({ error: "Sentry n'est pas configuré : ajoutez NEXT_PUBLIC_SENTRY_DSN dans Vercel puis redéployez." }, { status: 503 });
  }
  const eventId = Sentry.captureException(new Error(`Test Sentry depuis la console propriétaire (${new Date().toISOString()})`));
  const delivered = await Sentry.flush(5000);
  if (!delivered) {
    return NextResponse.json({ error: "L'erreur de test n'a pas pu être transmise à Sentry. Vérifiez le DSN." }, { status: 502 });
  }
  return NextResponse.json({ eventId });
}
