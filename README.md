# StockPilot Trade | Neon Edition

Independent port of StockPilot UK (v1.10.3) to **Neon Postgres + Neon Auth + Neon Data API**, retaining the original React, TypeScript and Vite workflows. Original Supabase infrastructure is unchanged.

Repository: https://github.com/owusuduahephraim1/stockpilot-trade

Expected GitHub Pages URL: https://owusuduahephraim1.github.io/stockpilot-trade/

Neon project: `broad-mode-13429363`, branch `production`, database `neondb`.

## Verified Neon database
- 10 operational tables
- 3 views (inventory, stock movements, operational alerts)
- 44 row-level security policies
- 17 application triggers
- 9 public and 3 private PostgreSQL functions
- Seeded 3 FX rates and 1 settings row
- Neon managed Auth and JWT-protected Data API are enabled

## Differences and setup
- Replaced Supabase browser requests with `@neondatabase/neon-js` using its Supabase-compatible auth adapter and PostgREST querying.
- GitHub Pages uses a hash router because it cannot route deep SPA URLs server-side.
- Original realtime events are replaced by a 30-second query refresh.
- Historical Supabase Auth UUID identities are intentionally **not** migrated because Neon Auth uses separate user identities. Create accounts in Neon Auth, then use `database/neon/bootstrap_admin.sql` to grant the first verified administrator.
- Users lacking active workspace profiles cannot read or mutate operational records. Keep account provision manual until a secure Neon Auth management service is deployed.
- Private R2 storage, admin user CRUD and daily FX synchronization require a protected Cloudflare Worker. They are not hosted by GitHub Pages. `reference/functions/` contains legacy Supabase functions for comparison and cannot run as-is.
- Set the GitHub Actions repository variable `VITE_API_BASE_URL` only after deploying the Cloudflare Worker; otherwise document and administrative endpoints show explicit configuration errors.
- Enable GitHub Pages with GitHub Actions as source at Settings → Pages if Actions deploy is disabled.

**Security:** Neon connection strings, R2 access credentials, Neon management API keys and signing secrets must never be committed in GitHub Pages. The public Neon Data API is constrained with RLS and JWTs.
