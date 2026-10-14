# Deploy StockPilot Trade Cloudflare R2 Worker

**Not yet deployed:** there is no authenticated Cloudflare R2 account connected to this session.

1. Log in with Wrangler from `cloudflare/worker` and install dependencies.
2. Create a **private** R2 bucket named `stockpilot-trade-documents`.
3. Store a strong random secret with `npx wrangler secret put SIGNED_URL_SECRET`.
4. Deploy `npx wrangler deploy`. The Worker validates Neon Auth JWTs and workspace membership, signs short-lived uploads/downloads, and checks file references.
5. Set the GitHub Actions variable `VITE_API_BASE_URL` to the deployed Worker URL, then redeploy the Pages frontend.

Admin user management and Bank of Ghana FX synchronization are not yet ported; their endpoints return HTTP 501. Do not expose Neon management credentials in the frontend or public repository.
