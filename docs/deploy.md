# Fairblox Deploy Guide

This guide covers the current public deployment path for Fairblox:

- frontend: Render static site
- API: Render web service
- database: managed Postgres
- payments: Stripe Checkout + Stripe webhook

## 1. Required URLs

Pick your public URLs first:

- web: `https://your-web-domain.example`
- API: `https://your-api-domain.example`

These values must stay consistent across Render and Stripe.

## 2. Required Environment Variables

### API service

Use [apps/api/.env.production.example](/abs/path/c:/Users/thegu/fairblox/apps/api/.env.production.example) as the template.

Required:

- `NODE_ENV=production`
- `DATABASE_URL`
- `APP_BASE_URL=https://your-web-domain.example`
- `API_BASE_URL=https://your-api-domain.example`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

Optional:

- `DISCORD_WEBHOOK_URL`

### Web static site

Use [apps/web/.env.production.example](/abs/path/c:/Users/thegu/fairblox/apps/web/.env.production.example) as the template.

Required:

- `VITE_API_BASE_URL=https://your-api-domain.example`

Optional:

- `VITE_UNITY_WEBGL_URL`

## 3. Render Setup

The repo already includes [render.yaml](/abs/path/c:/Users/thegu/fairblox/render.yaml).

Create these resources:

1. A Postgres database.
2. A web service named `fairblox-api`.
3. A static site named `fairblox-web`.

Then apply the env vars above to the matching service.

## 4. Stripe Setup

In Stripe Dashboard:

1. Go to `Developers` -> `Webhooks`.
2. Click `Add destination`.
3. Set the endpoint to:

```text
https://your-api-domain.example/payments/stripe/webhook
```

4. Subscribe to:

```text
checkout.session.completed
```

5. Reveal the signing secret.
6. Save that value as `STRIPE_WEBHOOK_SECRET` on the API service.

## 5. First Live Test

Use Stripe test mode first.

1. Deploy API.
2. Deploy web.
3. Open the public site.
4. Create or log into an account.
5. Open `Currency`.
6. Buy a coin bundle.
7. Complete the Stripe Checkout flow with a Stripe test card.
8. Wait for the redirect back to the site.
9. Confirm:
   - the order reaches fulfilled status
   - the wallet balance increases
   - the transaction appears in recent transactions

## 6. Troubleshooting

If checkout opens but coins do not arrive:

- verify `STRIPE_WEBHOOK_SECRET`
- verify the Stripe webhook endpoint URL
- verify the API service is public and healthy
- verify `APP_BASE_URL` and `API_BASE_URL`
- check API logs for webhook verification or fulfillment errors

If the web app loads but requests fail:

- verify `VITE_API_BASE_URL`
- confirm CORS is not blocked by a bad API URL
- confirm the API service is running and reachable from a browser

## 7. What Is Live Already

The current repo supports:

- public homepage
- discover flow
- creator flow
- avatar + inventory ownership/equip flow
- Stripe-backed coin bundle checkout
- PWA install shell

The next production-grade payment step after this is marketplace item checkout with real-money purchase flows, not just wallet coin purchases.
