import { createServiceClient } from "@/lib/supabase/server";

// Each club cashes in on its own SumUp account: keys live in organisation_secrets (server-only table),
// never in environment variables, which would be shared by every club.
const API = "https://api.sumup.com/v0.1";

export type SumupConfig = { apiKey: string; merchantCode: string };

export async function getSumupConfig(orgId: string): Promise<SumupConfig | null> {
  const { data } = await createServiceClient()
    .from("organisation_secrets")
    .select("sumup_api_key, sumup_merchant_code")
    .eq("organisation_id", orgId)
    .maybeSingle();
  if (!data?.sumup_api_key || !data?.sumup_merchant_code) return null;
  return { apiKey: data.sumup_api_key, merchantCode: data.sumup_merchant_code };
}

async function call(config: SumupConfig, path: string, init?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message || body?.error_message || `SumUp a répondu ${res.status}`);
  }
  return body;
}

export async function createCheckout(config: SumupConfig, params: {
  reference: string;
  amount: number;
  description: string;
  returnUrl: string;
}) {
  const body = await call(config, "/checkouts", {
    method: "POST",
    body: JSON.stringify({
      checkout_reference: params.reference,
      amount: Number(params.amount.toFixed(2)),
      currency: "EUR",
      merchant_code: config.merchantCode,
      description: params.description,
      return_url: params.returnUrl,
      redirect_url: params.returnUrl,
      hosted_checkout: { enabled: true },
    }),
  });
  const url = body.hosted_checkout_url || body.hosted_checkout?.url || body.checkout_url;
  if (!url) throw new Error("SumUp n'a pas renvoyé de page de paiement. Vérifiez que l'encaissement en ligne est activé sur le compte SumUp du club.");
  return { id: String(body.id), url: String(url) };
}

/** Source of truth for a payment: always re-read the checkout from SumUp, never trust the caller. */
export async function fetchCheckout(config: SumupConfig, checkoutId: string) {
  const body = await call(config, `/checkouts/${encodeURIComponent(checkoutId)}`);
  return { id: String(body.id), status: String(body.status || "").toUpperCase(), amount: Number(body.amount ?? 0) };
}

export async function verifierConfig(config: SumupConfig) {
  await call(config, `/merchants/${encodeURIComponent(config.merchantCode)}/payment-methods`);
}
