import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim() ?? "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? "";
const appBaseUrl = (process.env.APP_BASE_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");
const apiBaseUrl = (process.env.API_BASE_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
    })
  : null;

export function isStripeConfigured() {
  return Boolean(stripe && stripeWebhookSecret);
}

export function getPaymentsConfig() {
  return {
    appBaseUrl,
    apiBaseUrl,
  };
}

export async function createStripeCurrencyCheckoutSession(input: {
  orderId: string;
  userId: string;
  coins: number;
  usdCents: number;
  requestId?: string;
}) {
  if (!stripe) {
    throw new Error("Stripe is not configured on the server.");
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${appBaseUrl}/?purchase=success&order=${encodeURIComponent(input.orderId)}`,
    cancel_url: `${appBaseUrl}/?purchase=cancelled&order=${encodeURIComponent(input.orderId)}`,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.usdCents,
          product_data: {
            name: `${input.coins.toLocaleString()} Fairblox coins`,
            description: "Wallet credit for avatar items, marketplace purchases, and creator tools.",
          },
        },
      },
    ],
    metadata: {
      orderId: input.orderId,
      userId: input.userId,
      coins: String(input.coins),
      requestId: input.requestId ?? "",
    },
  });
  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }
  return {
    sessionId: session.id,
    checkoutUrl: session.url,
  };
}

export function verifyStripeWebhookEvent(payload: Buffer, signature: string) {
  if (!stripe || !stripeWebhookSecret) {
    throw new Error("Stripe webhook verification is not configured.");
  }
  return stripe.webhooks.constructEvent(payload, signature, stripeWebhookSecret);
}
