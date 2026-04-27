# Supabase

Use three projects: dev, staging, production.

Apply migrations to dev first, then staging, then production.

All authoritative game mutations should happen through Edge Functions using server-side validation and transactions.
