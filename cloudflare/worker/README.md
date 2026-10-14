# Cloudflare R2 deployment for StockPilot Trade

The existing GitHub Pages application remains the frontend. A Cloudflare Worker handles private R2 uploads, private downloads, and cleanup, without exposing credentials in GitHub Pages.

## First-time deployment: two GitHub Actions secrets

Go to https://github.com/owusuduahephraim1/stockpilot-trade/settings/secrets/actions

Under **Repository secrets**, separately add:
- **CLOUDFLARE_API_TOKEN**: your Cloudflare API token. Never put it in a source file or chat.
- **CLOUDFLARE_ACCOUNT_ID**: your Cloudflare account ID for the same account.

The token requires account permissions **Workers Scripts Edit** and **Workers R2 Storage Edit**. Restrict it to the intended account.

Then visit https://github.com/owusuduahephraim1/stockpilot-trade/actions/workflows/deploy-cloudflare-r2.yml and choose **Run workflow** on main.

The workflow checks the credentials without printing them, creates/reuses the **private** R2 bucket **stockpilot-trade-documents**, deploys **stockpilot-trade-api**, provisions a one-time cryptographic **SIGNED_URL_SECRET** in Cloudflare only if absent, discovers and verifies the workers.dev endpoint, and dispatches a GitHub Pages rebuild which automatically discovers the Worker address.

## Verification

A successful /health returns JSON containing status "ok" and storage "r2".
Authenticated uploads and downloads require separate verification through a signed-in Neon Auth user with a matching active workspace profile; /health alone does not test protected operations.

Administrator CRUD and automated FX sync still return HTTP 501 and require a separate secure implementation.
No R2 S3 access keys are needed because the Worker uses its bucket binding.
