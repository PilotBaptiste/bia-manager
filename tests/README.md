# Tests des droits par rôle

Ces tests vérifient qu'un visiteur, un parent, un coordinateur et un pilote ne peuvent pas faire ce qui leur est interdit, directement dans la base et via les routes API.

**À lancer uniquement sur un projet Supabase de test**, jamais sur la production : les tests tentent des actions interdites avec de vrais comptes.

## Mise en place

1. Créer un projet Supabase de test, y exécuter dans l'ordre `supabase-securite-2026-09.sql` puis `supabase-evolutions-2026-09.sql`.
2. Créer un compte par rôle (parent rattaché à au moins un élève, coordinateur rattaché à un établissement, pilote).
3. Créer `.env.test.local` à la racine :

```
TEST_SUPABASE_URL=https://xxxx.supabase.co
TEST_SUPABASE_ANON_KEY=...
TEST_APP_URL=http://localhost:3000
TEST_PARENT_EMAIL=...
TEST_PARENT_PASSWORD=...
TEST_COORDINATEUR_EMAIL=...
TEST_COORDINATEUR_PASSWORD=...
TEST_PILOTE_EMAIL=...
TEST_PILOTE_PASSWORD=...
```

4. Lancer :

```bash
npm run test:roles
```

Un rôle sans identifiants est ignoré. `TEST_APP_URL` active les tests des routes API (application démarrée localement ou déploiement de preview pointant vers la base de test).
