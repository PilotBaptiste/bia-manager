// Régénère supabase-schema-reference.sql à partir de la base réelle (tables, colonnes, types, clés).
// Usage : npm run db:schema   (lit NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY depuis .env.local)
// Les politiques RLS, fonctions et triggers ne sont pas exposés par l'API : voir supabase-introspection.sql.
import { readFileSync, writeFileSync, existsSync } from "node:fs";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (.env.local)");
  process.exit(1);
}

const res = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/openapi+json" },
});
if (!res.ok) {
  console.error(`Lecture du schéma impossible : HTTP ${res.status}`);
  process.exit(1);
}
const spec = await res.json();
const definitions = spec.definitions || {};

const isExpression = (v) => typeof v === "string" && /\(|::|^CURRENT_|^now$/i.test(v);
const sqlDefault = (col) => {
  if (col.default === undefined) return "";
  const v = col.default;
  if (typeof v === "number" || typeof v === "boolean") return ` DEFAULT ${v}`;
  if (isExpression(v)) return ` DEFAULT ${v}`;
  return ` DEFAULT '${String(v).replace(/'/g, "''")}'`;
};

const lines = [
  "-- ════════════════════════════════════════════════════════════════",
  "-- BIA Manager — schéma de référence généré depuis la base réelle",
  `-- Généré le ${new Date().toISOString().slice(0, 10)} par scripts/generate-schema-reference.mjs`,
  "-- Ne pas modifier à la main : relancer « npm run db:schema ».",
  "-- Contient tables, colonnes, types, NOT NULL, valeurs par défaut, clés primaires et étrangères.",
  "-- Politiques RLS, fonctions et triggers : voir supabase-introspection.sql.",
  "-- ════════════════════════════════════════════════════════════════",
  "",
];

for (const table of Object.keys(definitions).sort()) {
  const def = definitions[table];
  const required = new Set(def.required || []);
  const cols = [];
  const constraints = [];
  for (const [name, col] of Object.entries(def.properties || {})) {
    const type = col.format || col.type;
    const notNull = required.has(name) ? " NOT NULL" : "";
    cols.push(`  ${name} ${type}${notNull}${sqlDefault(col)}`);
    const desc = col.description || "";
    if (desc.includes("<pk/>")) constraints.push(`  PRIMARY KEY (${name})`);
    const fk = desc.match(/<fk table='([^']+)' column='([^']+)'\/>/);
    if (fk) constraints.push(`  FOREIGN KEY (${name}) REFERENCES ${fk[1]}(${fk[2]})`);
  }
  lines.push(`CREATE TABLE public.${table} (`);
  lines.push([...cols, ...constraints].join(",\n"));
  lines.push(");", "");
}

const rpcs = Object.keys(spec.paths || {}).filter((p) => p.startsWith("/rpc/")).map((p) => p.slice(5)).sort();
lines.push("-- Fonctions RPC exposées : " + (rpcs.length ? rpcs.join(", ") : "aucune"));

writeFileSync("supabase-schema-reference.sql", lines.join("\n") + "\n");
console.log(`supabase-schema-reference.sql : ${Object.keys(definitions).length} tables, ${rpcs.length} fonctions RPC`);
