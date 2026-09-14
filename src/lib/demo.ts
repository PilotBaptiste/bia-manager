// Demo/test accounts use reserved example domains (RFC 2606): nothing may ever be emailed to them,
// otherwise bounces would damage the sending domain's reputation.
export function isDemoAddress(email: string | null | undefined) {
  const e = (email || "").trim().toLowerCase();
  return /@example\.(com|org|net)$/.test(e) || e.endsWith(".example") || e.endsWith(".invalid") || e.endsWith(".test");
}
