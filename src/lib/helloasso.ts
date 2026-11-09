import { createServiceClient } from "@/lib/supabase/server";

// Paiement en ligne via HelloAsso, avec les clés propres à chaque aéroclub :
// chaque club encaisse sur son propre compte, et aucune clé ne passe par le navigateur.
// Les identifiants sont stockés dans organisation_secrets, table inaccessible au client.

const TOKEN_URL = "https://api.helloasso.com/oauth2/token";
const API = "https://api.helloasso.com/v5";

export type ClesHelloAsso = { clientId: string; clientSecret: string; slug: string };

/** Clés HelloAsso d'un club, ou null si le club n'est pas configuré. */
export async function clesDuClub(orgId: string): Promise<ClesHelloAsso | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const { data } = await createServiceClient()
    .from("organisation_secrets")
    .select("helloasso_client_id, helloasso_client_secret, helloasso_slug")
    .eq("organisation_id", orgId)
    .maybeSingle();
  const clientId = (data?.helloasso_client_id ?? "").trim();
  const clientSecret = (data?.helloasso_client_secret ?? "").trim();
  const slug = (data?.helloasso_slug ?? "").trim();
  if (!clientId || !clientSecret || !slug) return null;
  return { clientId, clientSecret, slug };
}

/**
 * Jeton d'accès HelloAsso (valable 30 min côté HelloAsso).
 * On en demande un par opération : plus simple et sans état à stocker.
 */
async function jeton(cles: ClesHelloAsso): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cles.clientId,
      client_secret: cles.clientSecret,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Authentification HelloAsso refusée (${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  if (!data?.access_token) throw new Error("HelloAsso n'a pas renvoyé de jeton d'accès");
  return data.access_token as string;
}

export type DemandePaiement = {
  montantCentimes: number;
  libelle: string;
  reference: string;
  urlRetour: string;
  urlErreur: string;
  urlAnnulation: string;
  payeur?: { prenom?: string; nom?: string; email?: string };
};

export type IntentionPaiement = { id: number; url: string };

/**
 * Crée une intention de paiement et renvoie l'adresse de la page de paiement HelloAsso.
 * `reference` nous revient dans les métadonnées : c'est ce qui relie le paiement à l'élève.
 */
export async function creerPaiement(cles: ClesHelloAsso, d: DemandePaiement): Promise<IntentionPaiement> {
  const token = await jeton(cles);
  const res = await fetch(`${API}/organizations/${encodeURIComponent(cles.slug)}/checkout-intents`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      totalAmount: d.montantCentimes,
      initialAmount: d.montantCentimes,
      itemName: d.libelle.slice(0, 250),
      backUrl: d.urlAnnulation,
      errorUrl: d.urlErreur,
      returnUrl: d.urlRetour,
      containsDonation: false,
      ...(d.payeur?.email
        ? { payer: { firstName: d.payeur.prenom || undefined, lastName: d.payeur.nom || undefined, email: d.payeur.email } }
        : {}),
      metadata: { reference: d.reference },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    if (res.status === 409) {
      throw new Error("Le compte HelloAsso de l'aéroclub n'est pas encore validé par HelloAsso.");
    }
    if (res.status === 403) {
      throw new Error("Les clés HelloAsso de l'aéroclub n'ont pas les droits nécessaires (Checkout).");
    }
    throw new Error(`HelloAsso a refusé la création du paiement (${res.status}). ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data?.id || !data?.redirectUrl) {
    throw new Error("HelloAsso n'a pas renvoyé de page de paiement");
  }
  return { id: data.id as number, url: data.redirectUrl as string };
}

export type EtatPaiement = {
  paye: boolean;
  montantCentimes: number | null;
  reference: string | null;
  payeurEmail: string | null;
};

/**
 * État réel d'un paiement, lu directement chez HelloAsso.
 * C'est cette lecture qui fait foi : on ne se fie jamais au simple retour du navigateur.
 */
export async function lirePaiement(cles: ClesHelloAsso, checkoutId: string): Promise<EtatPaiement> {
  const token = await jeton(cles);
  const res = await fetch(
    `${API}/organizations/${encodeURIComponent(cles.slug)}/checkout-intents/${encodeURIComponent(checkoutId)}`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Lecture du paiement impossible (${res.status}). ${detail.slice(0, 200)}`);
  }
  const data = await res.json();

  // `order` n'apparaît qu'une fois le paiement abouti ; les paiements y sont « Authorized » puis « Processed ».
  const paiements: any[] = data?.order?.payments ?? [];
  const paye = paiements.some((p) => ["Authorized", "Processed"].includes(String(p?.state)));
  const montant = paiements.find((p) => ["Authorized", "Processed"].includes(String(p?.state)))?.amount ?? null;

  return {
    paye,
    montantCentimes: typeof montant === "number" ? montant : null,
    reference: data?.metadata?.reference ?? null,
    payeurEmail: data?.payer?.email ?? data?.order?.payer?.email ?? null,
  };
}
