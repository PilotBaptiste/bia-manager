# Mise en place du pilote FFA — 4 aéroclubs

Checklist pour passer BIA Manager en multi-clubs : chaque aéroclub a son site `club.biamanager.com`, ses données sont isolées des autres, et le propriétaire de la plateforme gère tous les clubs depuis `admin.biamanager.com/plateforme`.

Tarifs indicatifs relevés en 2026 : à vérifier au moment de souscrire.

## 1. Ce qu'il faut prendre

| Service | Offre | Pourquoi | Coût indicatif |
|---|---|---|---|
| Nom de domaine | `biamanager.com` ✅ acheté | Une adresse par club (`acba.biamanager.com`) | ~15 € / an |
| Vercel | **Pro** | Obligatoire pour un usage non personnel, sous-domaines illimités | 20 $ / mois |
| Supabase | **Pro** | Sauvegardes quotidiennes, pas de mise en pause, base partagée par les clubs | 25 $ / mois |
| Resend | **Pro** | Emails depuis votre domaine ; l'offre gratuite plafonne à 100 emails / jour, vite atteint avec 4 clubs | 20 $ / mois |
| Supabase (2ᵉ projet) | Gratuit | Base de test pour les tests des droits (`npm run test:roles`) | 0 € |

**Total : environ 65 $ / mois + le domaine.**

## 2. Ordre de mise en place

> ⚠️ **Scripts SQL et code vont ensemble.** Les scripts 1 à 5 ont besoin du code de la PR #6, et le script 6 du code multi-clubs. Lancez chaque lot juste avant de publier le code correspondant (merge puis déploiement Vercel). Sinon, l'inscription publique et les emails de l'ancien code échouent entre-temps.

### Étape 1 — Base de données (Supabase)
1. **Sauvegarde** : Database › Backups, vérifier qu'une sauvegarde récente existe (ou en déclencher une).
2. Vérifier que le projet est hébergé en **Europe** (Settings › General › Region). C'est indispensable pour le RGPD, s'agissant de données de mineurs.
3. SQL Editor : exécuter **dans cet ordre** (tous relançables sans risque) :
   1. `supabase-securite-2026-09.sql`
   2. `supabase-evolutions-2026-09.sql`
   3. `supabase-tarifs-2026-09.sql`
   4. `supabase-tarifs-modification-2026-09.sql`
   5. `supabase-subventions-2026-09.sql`
   6. `supabase-multiclubs-2026-09.sql` : toutes les données existantes deviennent celles de l'ACBA (club `acba`)
4. Se donner le rôle propriétaire, avec votre adresse :
   ```sql
   UPDATE public.profiles SET roles = array_append(roles, 'proprietaire')
   WHERE lower(email) = lower('votre-adresse@exemple.fr') AND NOT ('proprietaire' = ANY (roles));
   ```

### Étape 2 — Domaine (Vercel)
1. Domaine `biamanager.com` : acheté, sans hébergement ni options.
2. Chez le registrar, remplacer les serveurs DNS par ceux de Vercel : `ns1.vercel-dns.com` et `ns2.vercel-dns.com`. C'est nécessaire pour le certificat des sous-domaines.
3. Vercel › projet › Settings › Domains : ajouter `biamanager.com` **et** `*.biamanager.com`.

### Étape 3 — Variables d'environnement (Vercel › Settings › Environment Variables)
| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_ROOT_DOMAIN` | `biamanager.com` (sans `https://` ni `www`) |
| `NEXT_PUBLIC_APP_URL` | `https://biamanager.com` |
| `RESEND_FROM` | `BIA Manager <noreply@biamanager.com>` |
| `RESEND_WEBHOOK_SECRET` | secret du webhook Resend (étape 4) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` | inchangées |

Redéployer après modification.

Sans `NEXT_PUBLIC_ROOT_DOMAIN`, l'application fonctionne sans sous-domaines : chacun travaille dans le club de son compte. C'est le cas en local et sur les déploiements de prévisualisation.

### Étape 4 — Emails (Resend)
1. Domains › Add domain › `biamanager.com`, puis ajouter les enregistrements DNS proposés (SPF, DKIM) dans Vercel › Domains › DNS.
2. Webhooks › Add endpoint : `https://biamanager.com/api/email/webhook`, événements `email.*`. Copier le secret dans `RESEND_WEBHOOK_SECRET`.

### Étape 5 — Connexion (Supabase › Authentication › URL Configuration)
- **Site URL** : `https://biamanager.com`
- **Redirect URLs** : `https://biamanager.com/**` et `https://*.biamanager.com/**`. Garder l'ancienne adresse Vercel pendant la transition.
- Recommandé : Authentication › SMTP Settings › activer le SMTP personnalisé avec Resend (`smtp.resend.com`, port 465, utilisateur `resend`, mot de passe = clé API). Les emails de connexion partent alors de votre domaine, sans limite horaire.

### Étape 6 — Vérifier puis ouvrir les clubs
1. Ouvrir `https://acba.biamanager.com` : l'ACBA doit retrouver toutes ses données.
2. Ouvrir `https://admin.biamanager.com/plateforme` : l'ACBA apparaît dans la liste.
3. **Nouvel aéroclub** pour chacun des 3 clubs du test : nom, sous-domaine, admin du club, année scolaire. L'admin reçoit un email pour activer son accès.
4. Chaque admin de club renseigne ensuite, sur son site : Paramètres (nom, lieu des vols, tarifs), Aéronefs, Établissements, Utilisateurs (pilotes, coordinateurs).

## 3. Côté juridique (avant d'accueillir des élèves)
Vous hébergez des données de mineurs pour le compte des clubs :
- **Contrat de sous-traitance (RGPD)** avec chaque club : le club est responsable du traitement, vous êtes sous-traitant.
- **Mentions légales** et **politique de confidentialité** accessibles depuis le site : finalités, durée de conservation, droits des familles, contact.
- **Registre des traitements** (modèle CNIL).
- Une **structure juridique** pour signer ces documents et les abonnements (association ou société).

## 4. Fonctionnement à connaître
- **Rôles** : « Admin du club » (ancien SuperAdmin) gère tout son club et uniquement son club. « Propriétaire » gère la plateforme ; il travaille dans un club à la fois et en change via **Plateforme › Entrer**.
- **Isolation** : elle est garantie par la base elle-même (règles de sécurité et déclencheurs), pas seulement par l'interface.
- **Un compte appartient à un seul club.** Un pilote ou un parent présent dans deux clubs aura besoin de deux adresses email pendant le pilote.
- **Codes d'inscription** : ils restent uniques sur toute la plateforme, et l'inscription publique rattache automatiquement l'élève au club de l'établissement.

## 5. Suivi des erreurs (Sentry)
1. Créez un compte sur sentry.io et choisissez la région de données **EU** à la création de l'organisation.
2. Créez un projet **Next.js**, puis copiez son **DSN** (Settings › Client Keys).
3. Dans Vercel › Environment Variables :

| Variable | Valeur | Type |
|---|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | le DSN (`https://…@….ingest.de.sentry.io/…`) | Config |
| `SENTRY_ORG` | le slug de l'organisation Sentry | Config |
| `SENTRY_PROJECT` | le slug du projet | Config |
| `SENTRY_AUTH_TOKEN` | Settings › Auth Tokens › Create Token (facultatif : sert à rendre les erreurs lisibles) | Secret |

4. Redéployez. Dans Sentry › Alerts, gardez l'alerte par email « nouvelle erreur » (activée par défaut).

Aucune donnée personnelle n'est envoyée : ni cookies, ni en-têtes, ni contenu des formulaires, ni paramètres d'URL.

## 6. Club de démonstration
`aeroclub-test.biamanager.com` sert de démo et d'environnement d'essai.
- **Remplir ou remettre à zéro** : `npm run seed:demo -- --reset`. Le script refuse tout club dont l'adresse ne contient pas « test » ou « demo », et vérifie que les autres clubs n'ont pas bougé.
- **Comptes** : `demo.pilote1@example.com`, `demo.coordinateur@example.com`, `demo.parent01@example.com`… Le mot de passe commun est affiché à la fin du script.
- **Emails** : aucun email n'est jamais envoyé aux adresses `@example.com`. Les envois sont enregistrés avec le statut « demo ».
- **Isolation** : `npm run test:isolation` (ajouter `CLUB_CIBLE=aeroclub-test` pour viser le club de démo).
