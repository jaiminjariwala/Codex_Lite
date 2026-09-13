# Backend and sandbox setup

The Go backend connects identity, sessions and subscription access. It does not run the default local Qwen inference.

## Request flow

```text
Desktop                 Go on Render       GitHub / Stripe       Supabase
   |                          |                    |                 |
   |-- start GitHub login --->|-- authorize ------>|                 |
   |                          |<-- callback -------|                 |
   |                          |-- account/session ----------------->|
   |<-- app session ----------|                    |                 |
   |                          |                    |                 |
   |-- create checkout ------>|-- sandbox session->|                 |
   |<-- checkout URL ---------|                    |                 |
   |---- browser test checkout ------------------->|                 |
   |                          |<-- signed webhook --|                 |
   |                          |-- update subscription ------------->|
   |-- refresh account ------>|                    |                 |
   |<-- access state ---------|                    |                 |
```

## Deployment shape

Use the existing `backend/Dockerfile` with the `backend` directory as its build context. Its Go build copies `go.mod`, `go.sum`, `cmd` and `internal` from that context.

Render runs the API container. Supabase supplies PostgreSQL. Choose the appropriate pooled connection string for your host's network support. Percent-encode special characters in the password portion of a database URI, for example `@` becomes `%40`.

Keep the chosen hosting plans and billing settings under review. This guide does not promise zero hosting costs or uninterrupted availability.

## Backend environment

| Name | Value |
| --- | --- |
| DATABASE_URL | Private PostgreSQL connection URI |
| SESSION_SECRET | Random secret with at least 32 characters |
| GITHUB_OAUTH_CLIENT_ID | OAuth application's client ID |
| GITHUB_OAUTH_CLIENT_SECRET | OAuth application's private secret |
| GITHUB_OAUTH_REDIRECT_URL | https://YOUR-BACKEND/v1/auth/github/callback |
| STRIPE_SECRET_KEY | Sandbox sk_test_ key |
| STRIPE_PUBLISHABLE_KEY | Matching sandbox pk_test_ key |
| STRIPE_PLUS_PRICE_ID | Sandbox price_ ID for the $1 USD monthly recurring price |
| CHECKOUT_URL | https://YOUR-BACKEND/checkout |
| STRIPE_WEBHOOK_SECRET | Signing secret of the hosted sandbox destination |

Use the same callback URL in GitHub. Do not use a Product ID beginning with `prod_` in place of the Price ID. Keep all Stripe values in the same sandbox.

Optional legacy hosted-AI environment settings are not required for local Qwen chat. The health endpoint's `ai_configured` field describes the hosted AI router, not local model readiness.

## Stripe event destination

Endpoint: `https://YOUR-BACKEND/v1/webhooks/stripe`.

Use snapshot events from your account:

- checkout.session.completed
- invoice.paid
- invoice.payment_failed
- customer.subscription.updated
- customer.subscription.deleted

Copy the new destination's `whsec_` signing secret into backend configuration. The Stripe CLI's local listener secret is different. Match the event API version to the backend's supported Stripe payloads and inspect logs if event decoding fails.

## Test checklist

1. Redeploy after saving environment values.
2. Check `GET /health`. Configuration presence is not proof that the credentials work.
3. Sign in from the desktop app.
4. Open sandbox checkout and confirm the demo notice.
5. Use 4242 4242 4242 4242, a future expiry, and any three-digit CVC.
6. Verify successful Stripe event delivery.
7. Return to the app and confirm access activates.
8. Restart the app and verify account state persists.
9. Test cancellation and subscription updates separately.

Never use real card details for this demo. A public backend can still use Stripe sandbox; public hosting does not require live payments.

## API surface

Account: `/v1/auth/github/start`, `/v1/auth/github/poll`, `/v1/auth/github/callback`, `/v1/me`.

Billing: `/v1/billing/checkout`, `/v1/billing/portal`, `/v1/webhooks/stripe`, `/checkout`, `/checkout/return`.

The backend also retains authenticated usage and cloud chat endpoints. The standard desktop Qwen client calls local Ollama instead.
