# Fairblox

Browser-first UGC game platform starter focused on simple multiplayer games and creator publishing.

## Workspace

- `apps/web`: React + Vite frontend shell
- `apps/api`: Express API starter
- `packages/types`: shared TypeScript types
- `db/schema.sql`: initial PostgreSQL schema
- `docs/mvp.md`: MVP product spec

## Quick Start

```powershell
cd C:\Users\thegu\fairblox
npm install
npm run dev
```

This starts:

- web: `http://localhost:5173`
- api: `http://localhost:4000`

For local frontend env, copy [apps/web/.env.example](/abs/path/c:/Users/thegu/fairblox/apps/web/.env.example) to `apps/web/.env` if you want to override the default API or Unity runtime URLs.

## Unity WebGL Runtime

Fairblox can use a Unity WebGL build as the primary live game runtime, while the browser app stays as the surrounding shell for discovery, session flow, wallet, inventory, and creator navigation.

1. Host your Unity WebGL build entry page (for example `index.html`) on a reachable URL.
2. Set the web app env var before starting Vite:

```powershell
$env:VITE_UNITY_WEBGL_URL="https://your-hosted-unity-build.example/index.html"
npm run dev
```

3. Open a game and join a session. If a Unity URL is available, Fairblox will prefer Unity automatically and load it inside the runtime shell.

You can also set a Unity URL per draft in the Creator editor. When present, the per-game URL is used first, and `VITE_UNITY_WEBGL_URL` acts as a fallback.

## Stripe Checkout Setup

Fairblox now supports real currency checkout for coin bundles through Stripe Checkout.

Set these API env vars before starting `@fairblox/api`:

```powershell
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_WEBHOOK_SECRET="whsec_..."
$env:APP_BASE_URL="http://localhost:5173"
$env:API_BASE_URL="http://localhost:4000"
```

Then forward Stripe webhooks to the local API:

```powershell
stripe listen --forward-to http://localhost:4000/payments/stripe/webhook
```

Coin bundles are fulfilled only after the Stripe webhook confirms checkout completion.

### Stripe Troubleshooting (Windows PowerShell)

If `stripe` is not recognized:

```powershell
winget install --id Stripe.StripeCli --accept-source-agreements --accept-package-agreements
```

If Stripe CLI was just installed, open a new terminal (or refresh `PATH` in the current one):

```powershell
$env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
```

Authenticate CLI once:

```powershell
stripe login
```

Start local dev from any directory (uses an absolute repo path):

```powershell
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_WEBHOOK_SECRET="whsec_..."
$env:APP_BASE_URL="http://localhost:5173"
$env:API_BASE_URL="http://localhost:4000"
npm --prefix C:\Users\thegu\fairblox run dev
```

In a separate terminal, run webhook forwarding:

```powershell
stripe listen --events checkout.session.completed --forward-to http://localhost:4000/payments/stripe/webhook
```

Notes:

- The `whsec_...` used for local testing should come from `stripe listen` output.
- In PowerShell, environment variables must use `$env:NAME="value"` syntax.
- `APP_BASE_URL=https://...` (without `$env:`) is shell syntax for bash/zsh, not PowerShell.

## Public Deploy

Fairblox now includes a baseline [render.yaml](/abs/path/c:/Users/thegu/fairblox/render.yaml) for deploying:

- `fairblox-api` as a Render web service
- `fairblox-web` as a Render static site

Before deploying:

1. Create a managed Postgres database and set `DATABASE_URL`.
2. Set `APP_BASE_URL` to your public web URL.
3. Set `API_BASE_URL` to your public API URL.
4. Set `VITE_API_BASE_URL` on the static site to the same public API URL.
5. Set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on the API service.
6. In Stripe, add a webhook destination pointing to:

```text
https://your-api-domain.example/payments/stripe/webhook
```

The frontend no longer assumes `localhost`; it reads `VITE_API_BASE_URL` in production and falls back to `http://localhost:4000` only for local development.

For the full production checklist, use [docs/deploy.md](/abs/path/c:/Users/thegu/fairblox/docs/deploy.md).

## First Build Targets

1. auth and profiles
2. game listing and game pages
3. draft/publish flow
4. obby editor data model
5. session join flow
