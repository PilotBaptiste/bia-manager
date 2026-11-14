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
   7. `supabase-modules-2026-09.sql` puis `supabase-modules-acba-2026-09.sql`
   8. `supabase-emails-desabonnement-2026-09.sql`
   9. `supabase-evolutions-2026-11.sql` : second parent, cours, posés en campagne, HelloAsso, règles du vol 2
   10. `supabase-cours-lms-2026-11.sql` : plusieurs documents par cours et suivi de lecture par élève
   11. `supabase-invitations-2026-11.sql` : statut d'activation des comptes parents, pour le bouton *Invitation parent*
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
- **Deux responsables légaux** (module *Deuxième parent*) : les deux reçoivent les emails, peuvent réserver et annuler, et chacun est prévenu de ce que fait l'autre. Chacun se désabonne séparément. Le second parent crée son accès avec « Mot de passe oublié », ou reçoit une invitation depuis la fiche de l'élève.
- **Vol 2 sans le BIA** : par défaut, un élève non admis perd l'autorisation du vol 2. Paramètres › Règles des vols permet à un club de la maintenir au cas par cas. Un élève peut aussi être marqué « ne souhaite pas faire le vol 2 » : il sort alors des listes et des relances.

## 5. Travailler sur deux années à la fois
Un club prépare souvent la rentrée suivante pendant que l'année en cours tourne encore. Deux notions distinctes :

- **L'année choisie** dans le sélecteur *Année scolaire* du menu est l'année de travail. Tout ce que vous créez depuis le tableau de bord s'y rattache : inscriptions d'élèves, import FFA ou CSV, créneaux de vol, subventions. Les listes Élèves, Vols, Finances, Statistiques et Messagerie n'affichent que cette année.
- **L'année en cours** est celle marquée ★, activée dans *Paramètres › Années scolaires*. Elle sert uniquement aux écrans qui n'ont pas de sélecteur : le tableau de bord d'accueil et les inscriptions venues du **formulaire public**.

Concrètement, pour inscrire les élèves de 2027-2028 pendant que 2026-2027 tourne : créez l'année dans *Paramètres › Années scolaires* (sans l'activer), sélectionnez-la dans le menu, puis importez ou inscrivez. L'écran d'import rappelle en haut l'année visée, et la fiche d'inscription le fait aussi. Activez 2027-2028 seulement quand vous voulez que le formulaire public et le tableau de bord basculent dessus — les créations depuis le tableau de bord, elles, n'en dépendent pas.

**Utilisateurs et rôles suit l'année.** Un compte qui n'est **que** parent n'apparaît que sur les années où il a un enfant inscrit : en 2026 vous voyez les familles de 2026, en 2027 celles de 2027. Tout compte portant un autre rôle — admin du club, coordinateur, pilote, gérant, propriétaire — reste visible sur toutes les années, même s'il est aussi parent. La case *Toutes les années* lève le filtre quand il faut retrouver un compte dont l'élève a été supprimé. Le bouton *Inviter les parents* n'écrit qu'aux familles de l'année affichée : vérifiez le sélecteur avant de l'utiliser.

**Le tableau de bord d'accueil suit aussi le sélecteur**, pour le coordinateur, le pilote et le gérant : les compteurs, les prochains vols et la liste des élèves sont ceux de l'année choisie, et l'année est rappelée sous le titre. Le suivi de lecture des cours et la liste des attestations signées (*Paramètres*) sont également filtrés. L'espace **parent** n'a pas de sélecteur : il montre les enfants, toutes années confondues, mais un enfant ne peut réserver qu'un créneau de **son** année.

**Un élève peut exister sur deux années.** Rien n'empêche de réinscrire un élève de 2026 en 2027 ; ce sont deux fiches distinctes, et la détection de doublon de l'import ne regarde que l'année visée.

**Les frais supplémentaires sont datés, pas rattachés à une année.** Une dépense saisie dans Finances est comptée sur l'année scolaire de sa date (1er septembre → 31 août). Le formulaire prévient si la date sort de l'année affichée.

## 6. Import des élèves depuis la FFA (SMILE)
Module **Import des élèves** › onglet **Export FFA (SMILE)**.

1. Sur SMILE FFA, ouvrez la liste des adhérents du club et exportez-la au format Excel (`Liste_Adherent.xls`). N'en modifiez pas l'en-tête.
2. Déposez le fichier dans l'onglet *Export FFA*. Le fichier est lu côté serveur : `.xls` (format ancien) comme `.xlsx` sont acceptés, jusqu'à 8 Mo.
3. L'écran d'aperçu est **modifiable**. L'export contient tous les adhérents du club : cochez les seuls élèves BIA (le bouton *Cocher les 13–20 ans* fait le premier tri à partir de la date de naissance), corrigez les cellules en rouge, et utilisez *Établissement à appliquer* pour renseigner d'un coup l'établissement et la classe des lignes cochées.
4. Lancez l'import. Les lignes incomplètes bloquent le bouton : nom, prénom, date de naissance au format `jj/mm/aaaa` et établissement sont obligatoires.

**Correspondance des colonnes**

| Colonne FFA | Champ BIA Manager |
|---|---|
| Nom, Prénom | nom, prénom de l'élève |
| DDN | date de naissance |
| Adresse + Adresse 2, Code postal, Ville | adresse de l'élève |
| Email | **adresse du responsable légal** |
| Portable, sinon Téléphone | téléphone du responsable légal |
| BIA Obtenu, Mention | BIA passé, résultat et mention |
| Etablissement | établissement (créé s'il n'existe pas) |
| Civilité, Nb. min AV, Nb. min AR, Responsable CAEA | *non importés* |

L'export FFA ne contient pas l'identité du responsable légal : l'import propose le nom de l'élève et le prénom « Parent », à corriger dans l'aperçu.

**Comptes des familles.** La case *Créer les comptes des responsables légaux* (cochée par défaut) crée les comptes manquants et les rattache à leurs enfants. **Aucun email n'est envoyé pendant l'import** — ni par cette case, ni par la création des élèves. L'accès est transmis plus tard, quand le club le décide, par le bouton **Invitation parent** de la page Élèves (section 7) ou par **Utilisateurs et rôles › Inviter les parents** : ces boutons n'écrivent qu'aux adresses des deux responsables légaux des élèves de l'année affichée, et proposent « Définissez votre mot de passe » aux comptes qui ne se sont jamais connectés.

Le même écran garde l'onglet **Fichier CSV** (template téléchargeable) pour les clubs qui préparent leur liste à la main.

## 7. Inviter les familles (bouton *Invitation parent*)
Page **Élèves** › bouton **Invitation parent** (admin du club, coordinateur, gérant). C'est l'email qui donne aux familles l'accès à leur espace : suivi du dossier, attestation, réservation des vols.

1. Choisissez les destinataires :
   - **Parents sans accès** — ceux qui n'ont pas de compte, et ceux dont le compte a été créé par l'import mais jamais activé. C'est le cas courant après un import FFA.
   - **Élèves sélectionnés** — les parents des élèves cochés dans la liste, pour une relance ciblée.
2. Écrivez le **mot d'introduction** (optionnel, 2 000 caractères). Il apparaît en tête de l'email, avant le bouton d'activation : c'est là que le responsable BIA se présente au club. Il est facultatif, l'email reste complet sans lui.
3. La liste des destinataires s'affiche avant l'envoi, avec le nom des enfants rattachés. Un parent de deux élèves ne reçoit qu'un email, et les deux responsables légaux sont servis.

Les destinataires sont toujours ceux de **l'année choisie dans le sélecteur** et des filtres actifs de la liste : vérifiez les deux avant d'envoyer. Un parent qui s'est désabonné des emails ne reçoit rien, y compris ce lien. Chaque envoi est tracé dans l'historique des emails de la fiche élève.

Pour un seul parent, le bouton *Invitation parent* de la fiche élève envoie l'email sans mot d'introduction.

## 8. Suivi des erreurs (Sentry)
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

## 9. Cours en ligne

Le module **Cours en ligne** sert de petit espace de révision pour les familles.

**Côté aéroclub** (admin du club ou coordinateur) : un cours est un contenant, auquel on ajoute autant de **documents et de liens** que nécessaire — PDF, présentations, images, vidéos, pages web. Un cours reste en brouillon tant qu'il n'est pas publié. Le bouton **Suivi** d'un cours montre, élève par élève, combien de documents ont été ouverts et si le cours est marqué terminé, avec un export CSV.

**Côté familles** : chaque enfant a sa propre partie, avec son nom et sa progression. Un parent de deux enfants voit donc deux listes distinctes. Les PDF et les images s'affichent directement dans l'application, le reste se télécharge, et la famille marque le cours comme terminé quand il est travaillé.

**La progression appartient à l'élève, pas au compte.** Les deux parents d'un même enfant voient et alimentent la même progression ; deux enfants d'un même parent en ont deux distinctes.

Taille maximale par document : 50 Mo. Les fichiers sont rangés dans un dossier par club et ne sont lisibles que par un lien signé, valable 5 minutes, généré après vérification des droits.

## 10. Paiement en ligne (HelloAsso)

Chaque aéroclub encaisse sur **son propre compte HelloAsso** : aucune somme ne transite par BIA Manager, et aucune clé n'est en variable d'environnement.

1. Dans la console propriétaire, activez le module **Paiement en ligne (HelloAsso)** pour le club.
2. Le club vous communique ses clés d'API : HelloAsso › Mon compte › Intégrations › API (`client_id`, `client_secret`) ainsi que le nom de son organisation (le `slug` visible dans `helloasso.com/associations/<slug>`).
3. Console propriétaire › icône carte bancaire sur la ligne du club : saisissez les trois valeurs puis **Enregistrer et vérifier**. La clé secrète est stockée côté serveur et ne ressort jamais.
4. Prérequis côté HelloAsso : le compte de l'association doit être **validé** et disposer de l'autorisation **Checkout**, sinon les paiements sont refusés (erreur 409 ou 403).

Côté familles, un bouton « Payer en ligne » apparaît sur le tableau de bord parent quand le paiement est en attente. Le montant est le **prix d'inscription** du club (Paramètres › Tarification). Le règlement n'est marqué payé qu'après vérification du paiement directement auprès de HelloAsso.

En cas de besoin, un paiement peut toujours être saisi à la main dans la fiche de l'élève (chèque, virement, espèces) : le module ne remplace rien, il ajoute une possibilité.

## 11. SMS et WhatsApp

**SMS — pas retenu pour le pilote.** Comptez 0,05 à 0,08 € par SMS en France (Brevo, OVH, Twilio — tarifs à revérifier au moment de souscrire). Pour 600 clubs, le coût devient significatif et impose une mention « STOP » ainsi qu'un recueil de consentement distinct de celui des emails. À réévaluer après le pilote, en comparant les fournisseurs.

**WhatsApp Business Platform — déconseillé.** L'envoi automatisé exige la vérification de l'entreprise auprès de Meta, la validation de chaque modèle de message, et une facturation à la conversation. Le lien `wa.me` déjà en place (Paramètres › Support aux familles) couvre le besoin réel sans aucune de ces contraintes : la famille écrit, le club répond depuis son téléphone.

## 12. Club de démonstration
`aeroclub-test.biamanager.com` sert de démo et d'environnement d'essai.
- **Remplir ou remettre à zéro** : `npm run seed:demo -- --reset`. Le script refuse tout club dont l'adresse ne contient pas « test » ou « demo », et vérifie que les autres clubs n'ont pas bougé.
- **Comptes** : `demo.pilote1@example.com`, `demo.coordinateur@example.com`, `demo.parent01@example.com`… Mot de passe commun : `admin123` (modifiable avec la variable `DEMO_PASSWORD`).
- **Emails** : aucun email n'est jamais envoyé aux adresses `@example.com`. Les envois sont enregistrés avec le statut « demo ».
- **Isolation** : `npm run test:isolation` (ajouter `CLUB_CIBLE=aeroclub-test` pour viser le club de démo).
- **Secondes familles** : deux familles de démo ont un second responsable légal (`demo.parent01b@example.com`, `demo.parent03b@example.com`) pour montrer le cas des parents séparés.
- **Cours** : cinq ressources de démonstration (des liens) sont créées, une par matière du BIA.
- Pour une démo complète, activez sur ce club les modules **Deuxième parent**, **Cours en ligne** et **Posés en campagne** depuis la console propriétaire.
