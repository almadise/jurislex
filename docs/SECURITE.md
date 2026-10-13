# Sécurité & confidentialité (S3)

## Données de dossier

Toutes les données de dossier sont traitées comme **sensibles**.

| Contrôle | Implémentation S3 |
|----------|-------------------|
| Authentification | Inscription / login + cookie httpOnly `jurislex_session` |
| Isolation | Filtrage strict `ownerId` (store local) ; RLS Supabase fourni |
| Audit | `audit_events` / journal local (create, update, delete, export, access_denied) |
| Masquage logs | E-mails masqués (`maskEmail`) ; mots de passe jamais loggés |
| Secrets | `.env.local` uniquement ; `JURISLEX_SESSION_SECRET` |
| Export / suppression | Export JSON audité ; archive soft ou `?hard=1` |
| Compte démo en clair | **Retiré** |

## Store local vs Supabase

- **Développement / smoke-tests** : `build/local-db.json` (utilisateurs scrypt, dossiers, audit).
- **Production** : appliquer `supabase/migrations/002_s3_matters_auth.sql` (profiles, matters, parties, evidence, audit + RLS).

## Menaces couvertes (partiel)

- Accès croisé dossier d’un autre utilisateur → 404 + audit
- Élévation admin à l’inscription (sauf premier compte) → bloquée
- Session sans cookie / token → 401 sur `/api/matters`

## C1 — correctifs livrés

- **Pas d’élévation de rôle à l’inscription** : trigger SQL force `standard` ; metadata `role` ignorée ; UI sans sélecteur de rôle.
- Promotion : `select public.promote_user_role(user_id, 'reviewer'|'admin')` (admin ou service_role).
- Rôle de session Supabase lu depuis `public.profiles`.
- Runbook prod : [docs/CYCLE_C1.md](CYCLE_C1.md).

## Restant (roadmap C2/C3)

- Chiffrement au repos configuré côté hébergeur + chiffrement applicatif champs sensibles
- Durée de conservation configurable
- Protection renforcée mineurs / santé / pénal / financier
- Rôle réviseur multi-dossiers org + ACL par dossier
- Consentement entraînement LLM explicite
