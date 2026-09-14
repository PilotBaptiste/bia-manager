// Remplit un aéroclub de démonstration avec des données fictives réalistes :
// établissements, avions, pilotes, coordinateur, parents, élèves à tous les stades, créneaux, vols clôturés, subvention.
//
// Usage : npm run seed:demo                       (club « aeroclub-test »)
//         CLUB=aeroclub-test npm run seed:demo -- --reset   (efface d'abord toutes les données de ce club)
//
// Sécurités :
//  • refuse tout club dont l'adresse ne contient pas « test » ou « demo » ;
//  • chaque écriture précise explicitement le club ; les chiffres des autres clubs sont comparés avant/après ;
//  • tous les comptes utilisent des adresses @example.com, auxquelles l'application n'envoie jamais d'email.
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");

const SLUG = process.env.CLUB || "aeroclub-test";
const RESET = process.argv.includes("--reset");
if (!/test|demo/.test(SLUG)) {
  console.error(`Refusé : « ${SLUG} » n'est pas un club de test ou de démonstration.`);
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const must = (label) => ({ data, error }) => {
  if (error) throw new Error(`${label} : ${error.message}`);
  return data;
};

const TABLES = ["eleves", "etablissements", "creneaux", "reservations", "vols_effectues", "aeronefs", "subventions", "profiles"];
async function snapshotOthers(orgId) {
  const out = {};
  for (const t of TABLES) {
    const { count } = await db.from(t).select("id", { count: "exact", head: true }).neq("organisation_id", orgId);
    out[t] = count ?? 0;
  }
  return out;
}

const { data: org } = await db.from("organisations").select("id, slug, nom").eq("slug", SLUG).maybeSingle();
if (!org) {
  console.error(`Club « ${SLUG} » introuvable. Créez-le d'abord depuis la console propriétaire.`);
  process.exit(1);
}
const ORG = org.id;
const before = await snapshotOthers(ORG);

// ── Remise à zéro du club de démo uniquement ─────────────────────
const { count: existing } = await db.from("eleves").select("id", { count: "exact", head: true }).eq("organisation_id", ORG);
if (existing && !RESET) {
  console.error(`« ${org.nom} » contient déjà ${existing} élève(s). Relancez avec --reset pour repartir de zéro.`);
  process.exit(1);
}
if (RESET) {
  for (const t of ["vols_lignes", "vols_effectues", "reservations", "creneaux", "subventions", "eleves", "pilote_qualifications",
    "pilote_etablissements", "aeronef_tarifs", "aeronefs", "etablissements", "email_logs", "activity_logs"]) {
    await db.from(t).delete().eq("organisation_id", ORG).then(must(`Remise à zéro ${t}`));
  }
  const { data: demoProfiles } = await db.from("profiles").select("id, email").eq("organisation_id", ORG).like("email", "%@example.com");
  for (const p of demoProfiles ?? []) await db.auth.admin.deleteUser(p.id);
  console.log(`Remise à zéro de « ${org.nom} » : ${demoProfiles?.length ?? 0} compte(s) de démo supprimé(s).`);
}

// ── Référentiels ─────────────────────────────────────────────────
const annee = await db.from("annees").select("id, label").eq("organisation_id", ORG).eq("active", true).single().then(must("Année active"));
await db.from("annees").update({ date_examen_bia: "2027-05-19" }).eq("id", annee.id).then(must("Date d'examen"));

const param = async (cle, valeur) => {
  const { data } = await db.from("parametres").select("id").eq("organisation_id", ORG).eq("cle", cle).maybeSingle();
  if (data) await db.from("parametres").update({ valeur }).eq("id", data.id).then(must(`Réglage ${cle}`));
  else await db.from("parametres").insert({ organisation_id: ORG, cle, valeur }).then(must(`Réglage ${cle}`));
};
await param("lieu_vol", "Aérodrome de démonstration\n00000 Ville-Démo");
await param("email_aeroclub", "contact@example.com");
await param("telephone_aeroclub", "01 23 45 67 89");
const { data: tpl } = await db.from("parametres").select("id, valeur").eq("organisation_id", ORG).eq("cle", "template_attestation").maybeSingle();
if (tpl?.valeur) {
  const fixed = tpl.valeur.replace(/(de )?l['’]A[eé]ro-?Club du Bassin d['’]Arcachon/gi, (_m, de) => `${de ?? ""}{NOM_AEROCLUB}`);
  if (fixed !== tpl.valeur) await db.from("parametres").update({ valeur: fixed }).eq("id", tpl.id).then(must("Modèle d'attestation"));
}

const code = () => `DEMO${randomBytes(3).toString("hex").toUpperCase()}`;
const etabs = await db.from("etablissements").insert([
  { organisation_id: ORG, nom: "Lycée Saint-Exupéry (démo)", ville: "Ville-Démo", actif: true, code_inscription: code(), nb_eleves_attendus: 30, contact_prenom: "Claire", contact_nom: "Martin", email: "lycee-saint-exupery@example.com" },
  { organisation_id: ORG, nom: "Collège Jean Mermoz (démo)", ville: "Ville-Démo", actif: true, code_inscription: code(), nb_eleves_attendus: 20, contact_prenom: "Paul", contact_nom: "Durand", email: "college-mermoz@example.com" },
  { organisation_id: ORG, nom: "Lycée Hélène Boucher (démo)", ville: "Autre-Démo", actif: true, code_inscription: code(), nb_eleves_attendus: 15, contact_prenom: "Sophie", contact_nom: "Leroy", email: "lycee-boucher@example.com" },
]).select("id, nom, code_inscription").then(must("Établissements"));

const avions = await db.from("aeronefs").insert([
  { organisation_id: ORG, immatriculation: "F-GDEM", type_aeronef: "DR400-120 (démo)", nb_places_eleves: 3, prix_heure: 180, actif: true },
  { organisation_id: ORG, immatriculation: "F-HDEM", type_aeronef: "Cessna 152 (démo)", nb_places_eleves: 1, prix_heure: 150, actif: true },
]).select("id, immatriculation, prix_heure, nb_places_eleves").then(must("Aéronefs"));
const [dr400, c152] = avions;

// ── Comptes ──────────────────────────────────────────────────────
const password = `Demo-${randomBytes(9).toString("base64url")}`;
const accounts = [];
async function account(email, prenom, nom, roles, extra = {}) {
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { prenom, nom } }).then(must(`Compte ${email}`));
  const id = created.user.id;
  for (let i = 0; i < 6; i++) {
    const { data } = await db.from("profiles").update({ organisation_id: ORG, prenom, nom, roles, telephone: "06 00 00 00 00", ...extra }).eq("id", id).select("id");
    if (data?.length) break;
    await new Promise((r) => setTimeout(r, 700));
  }
  accounts.push({ email, roles: roles.join(", ") });
  return { id, email, prenom, nom };
}

const pilote1 = await account("demo.pilote1@example.com", "Julien", "Aubert", ["pilote"]);
const pilote2 = await account("demo.pilote2@example.com", "Camille", "Roux", ["pilote"]);
await account("demo.coordinateur@example.com", "Claire", "Martin", ["coordinateur"], { etablissement_id: etabs[0].id, etablissement_ids: [etabs[0].id] });
await db.from("pilote_qualifications").insert([
  { organisation_id: ORG, pilote_id: pilote1.id, aeronef_id: dr400.id },
  { organisation_id: ORG, pilote_id: pilote1.id, aeronef_id: c152.id },
  { organisation_id: ORG, pilote_id: pilote2.id, aeronef_id: dr400.id },
  { organisation_id: ORG, pilote_id: pilote2.id, aeronef_id: c152.id },
]).then(must("Qualifications"));
await db.from("pilote_etablissements").insert(
  [pilote1, pilote2].flatMap((p) => etabs.map((e) => ({ organisation_id: ORG, pilote_id: p.id, etablissement_id: e.id }))),
).then(must("Pilotes / établissements"));

// ── Familles et élèves ───────────────────────────────────────────
// Stades : done = Vol 1 effectué · booked = réservé · ready = payé + attestation · attest = payé sans attestation
//          new = rien · quit = abandonné
const FAMILLES = [
  { parent: ["Nathalie", "Bernard"], enfants: [["Lucas", 0, "done"], ["Emma", 1, "booked"]] },
  { parent: ["Olivier", "Petit"], enfants: [["Hugo", 0, "done"]] },
  { parent: ["Sandrine", "Moreau"], enfants: [["Léa", 0, "done"], ["Nathan", 1, "ready"]] },
  { parent: ["Thomas", "Laurent"], enfants: [["Chloé", 2, "done"]] },
  { parent: ["Isabelle", "Simon"], enfants: [["Louis", 0, "booked"]] },
  { parent: ["Frédéric", "Michel"], enfants: [["Manon", 2, "booked"]] },
  { parent: ["Céline", "Garcia"], enfants: [["Jules", 0, "ready"], ["Inès", 1, "attest"]] },
  { parent: ["Stéphane", "David"], enfants: [["Zoé", 1, "ready"]] },
  { parent: ["Aurélie", "Bertrand"], enfants: [["Adam", 2, "ready"]] },
  { parent: ["Nicolas", "Robert"], enfants: [["Camille", 0, "attest"]] },
  { parent: ["Émilie", "Richard"], enfants: [["Gabriel", 1, "attest"], ["Jade", 0, "new"]] },
  { parent: ["Laurent", "Dubois"], enfants: [["Raphaël", 1, "new"]] },
  { parent: ["Valérie", "Lambert"], enfants: [["Lina", 2, "new"]] },
  { parent: ["Christophe", "Fontaine"], enfants: [["Tom", 0, "quit"]] },
];

const eleves = [];
let n = 0;
for (const fam of FAMILLES) {
  n++;
  const [pp, pn] = fam.parent;
  const email = `demo.parent${String(n).padStart(2, "0")}@example.com`;
  const parent = await account(email, pp, pn, ["parent"]);
  for (const [prenom, etabIndex, stade] of fam.enfants) {
    const paid = ["done", "booked", "ready", "attest"].includes(stade);
    const attested = ["done", "booked", "ready"].includes(stade);
    const row = await db.from("eleves").insert({
      organisation_id: ORG,
      annee_id: annee.id,
      etablissement_id: etabs[etabIndex].id,
      nom: pn,
      prenom,
      date_naissance: `2010-0${(n % 9) + 1}-1${n % 9}`,
      lieu_naissance: "Ville-Démo",
      classe: etabIndex === 1 ? "3e" : "1re",
      parent_id: parent.id,
      parent_nom: pn,
      parent_prenom: pp,
      parent_email: email,
      parent_telephone: "06 00 00 00 00",
      paiement_effectue: paid,
      paiement_montant: paid ? 60 : null,
      paiement_mode: paid ? (n % 2 ? "Chèque" : "Virement") : null,
      paiement_date: paid ? "2026-09-08T10:00:00Z" : null,
      attestation_signee: attested,
      attestation_date: attested ? "2026-09-09T18:30:00Z" : null,
      attestation_parent_signataire: attested ? `${pp} ${pn}` : null,
      abandonne: stade === "quit",
      archive: false,
      commentaires: stade === "quit" ? "Élève de démonstration : a abandonné le BIA." : null,
    }).select("id, prenom, nom").single().then(must(`Élève ${prenom}`));
    eleves.push({ ...row, stade });
  }
}

// ── Créneaux, réservations et vols ───────────────────────────────
const byStade = (s) => eleves.filter((e) => e.stade === s);
async function creneau({ date, debut, fin, avion, pilote, statut }) {
  return db.from("creneaux").insert({
    organisation_id: ORG, annee_id: annee.id, date_vol: date, heure_debut: debut, heure_fin: fin,
    aeronef_id: avion.id, pilote_id: pilote.id, places_disponibles: avion.nb_places_eleves, statut,
  }).select("id").single().then(must(`Créneau ${date} ${debut}`));
}
async function reserver(creneauId, eleve, statut) {
  await db.from("reservations").insert({ organisation_id: ORG, creneau_id: creneauId, eleve_id: eleve.id, type_vol: 1, statut }).then(must(`Réservation ${eleve.prenom}`));
}
async function cloturer({ creneauId, avion, pilote, minutes, eleves: passagers, numero }) {
  const prix = Math.round((minutes / 60) * avion.prix_heure * 100) / 100;
  await db.from("vols_effectues").insert({
    organisation_id: ORG, creneau_id: creneauId, numero_aerogest: numero, temps_vol_minutes: minutes,
    nb_eleves: passagers.length, prix_total: prix, valide_par: pilote.id,
  }).then(must("Vol clôturé"));
  for (const e of passagers) {
    await reserver(creneauId, e, "effectue");
    await db.from("eleves").update({
      vol1_effectue: true, vol1_temps_minutes: minutes, vol1_aeronef_id: avion.id,
      vol1_prix: Math.round((prix / passagers.length) * 100) / 100, vol1_pilote_nom: `${pilote.prenom} ${pilote.nom}`, vol1_numero_aerogest: numero,
    }).eq("id", e.id).then(must(`Vol 1 de ${e.prenom}`));
  }
}

const done = byStade("done");
const c1 = await creneau({ date: "2026-09-05", debut: "09:00", fin: "10:00", avion: dr400, pilote: pilote1, statut: "termine" });
await cloturer({ creneauId: c1.id, avion: dr400, pilote: pilote1, minutes: 45, eleves: done.slice(0, 3), numero: "DEMO-0001" });
const c2 = await creneau({ date: "2026-09-12", debut: "14:00", fin: "14:45", avion: c152, pilote: pilote2, statut: "termine" });
await cloturer({ creneauId: c2.id, avion: c152, pilote: pilote2, minutes: 30, eleves: done.slice(3, 4), numero: "DEMO-0002" });

const booked = byStade("booked");
const c3 = await creneau({ date: "2026-09-26", debut: "09:00", fin: "10:30", avion: dr400, pilote: pilote1, statut: "ouvert" });
await reserver(c3.id, booked[0], "reserve");
await reserver(c3.id, booked[1], "reserve");
await creneau({ date: "2026-09-26", debut: "10:30", fin: "11:15", avion: c152, pilote: pilote2, statut: "ouvert" });
const c5 = await creneau({ date: "2026-10-03", debut: "14:00", fin: "15:30", avion: dr400, pilote: pilote2, statut: "ouvert" });
await reserver(c5.id, booked[2], "reserve");
await creneau({ date: "2026-10-10", debut: "09:00", fin: "10:30", avion: dr400, pilote: pilote1, statut: "ouvert" });

await db.from("subventions").insert({
  organisation_id: ORG, annee_id: annee.id, libelle: "Aide régionale au BIA (démo)", financeur: "Région Démo",
  montant_total: 900, date: "2026-09-10", etablissement_ids: [etabs[0].id, etabs[1].id], note: "Subvention fictive de démonstration",
}).then(must("Subvention"));

// ── Vérification : les autres clubs n'ont pas bougé ──────────────
const after = await snapshotOthers(ORG);
const changed = TABLES.filter((t) => before[t] !== after[t]);

console.log(`\n✅ « ${org.nom} » rempli : ${etabs.length} établissements, ${avions.length} avions, ${eleves.length} élèves, 6 créneaux, 2 vols clôturés, 1 subvention.`);
console.log("\nCodes d'inscription :");
for (const e of etabs) console.log(`  ${e.nom} → ${e.code_inscription}`);
console.log(`\nComptes de démo (mot de passe commun : ${password}) :`);
for (const a of accounts) console.log(`  ${a.email}  [${a.roles}]`);
console.log(changed.length
  ? `\n❌ ATTENTION : chiffres modifiés hors du club de démo pour ${changed.join(", ")}`
  : "\n✅ Autres clubs vérifiés : aucune donnée modifiée en dehors du club de démo.");
process.exit(changed.length ? 1 : 0);
