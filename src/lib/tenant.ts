// Club resolution from the request host: "<slug>.<ROOT_DOMAIN>" → slug.
// Without NEXT_PUBLIC_ROOT_DOMAIN (local dev, Vercel previews) there is no subdomain routing:
// each user simply works in the club attached to their profile.
export const ROOT_DOMAIN = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "").toLowerCase().replace(/^\.+|\.+$/g, "");

export const RESERVED_SLUGS = ["www", "app", "admin", "api", "plateforme", "mail", "static"];

export const ORG_SLUG_HEADER = "x-bia-org-slug";

export function hostWithoutPort(host: string | null | undefined) {
  return (host || "").toLowerCase().split(":")[0];
}

/** Club slug carried by the host, or null on the root domain / unrelated hosts. */
export function slugFromHost(host: string | null | undefined): string | null {
  if (!ROOT_DOMAIN) return null;
  const h = hostWithoutPort(host);
  if (!h.endsWith(`.${ROOT_DOMAIN}`)) return null;
  const sub = h.slice(0, -(ROOT_DOMAIN.length + 1));
  if (!sub || sub.includes(".") || RESERVED_SLUGS.includes(sub)) return null;
  return sub;
}

/** Public showcase site: biamanager.com and www. */
export function isRootHost(host: string | null | undefined) {
  if (!ROOT_DOMAIN) return false;
  const h = hostWithoutPort(host);
  return h === ROOT_DOMAIN || h === `www.${ROOT_DOMAIN}`;
}

/** Owner console: admin.biamanager.com. */
export function isAdminHost(host: string | null | undefined) {
  if (!ROOT_DOMAIN) return false;
  return hostWithoutPort(host) === `admin.${ROOT_DOMAIN}`;
}

/** Absolute URL of a club site (falls back to the current origin when subdomains are not configured). */
export function clubUrl(slug: string, path = "/", currentOrigin?: string) {
  if (!ROOT_DOMAIN) return `${currentOrigin || ""}${path}`;
  const protocol = currentOrigin?.startsWith("http://") ? "http" : "https";
  return `${protocol}://${slug}.${ROOT_DOMAIN}${path}`;
}

export function platformUrl(path = "/", currentOrigin?: string) {
  if (!ROOT_DOMAIN) return `${currentOrigin || ""}${path}`;
  const protocol = currentOrigin?.startsWith("http://") ? "http" : "https";
  return `${protocol}://admin.${ROOT_DOMAIN}${path}`;
}

/**
 * Auth cookies shared by every club subdomain so a login follows the user across redirects.
 * Only on hosts under ROOT_DOMAIN: a browser rejects a `.biamanager.com` cookie on another host (e.g. *.vercel.app).
 */
export function authCookieOptionsFor(host: string | null | undefined) {
  if (!ROOT_DOMAIN) return undefined;
  const h = hostWithoutPort(host);
  return h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`) ? { domain: `.${ROOT_DOMAIN}` } : undefined;
}
