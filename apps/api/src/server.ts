import cors from "cors";
import express from "express";
import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type {
  AccountStateResponse,
  ApiHealthResponse,
  CreateMarketplaceItemRequest,
  CurrencyPurchaseCheckoutRequest,
  CurrencyPurchaseCheckoutResponse,
  CurrencyPurchaseOrderResponse,
  PurchaseMarketplaceItemRequest,
  PurchaseCurrencyRequest,
  CreateMarketplaceTradeRequest,
  CreateGameRequest,
  GameMapData,
  GameSessionSummary,
  LoginRequest,
  PublishedGameDetail,
  PublishGameRequest,
  SaveAccountStateRequest,
  SaveMapRequest,
  SignupRequest,
  EconomySummaryResponse,
} from "@fairblox/types";
import { createStore } from "./store.js";
import { featuredGames } from "./data.js";
import { sendAlert } from "./discord.js";
import {
  createStripeCurrencyCheckoutSession,
  isStripeConfigured,
  verifyStripeWebhookEvent,
} from "./payments.js";

const app = express();
const port = Number(process.env.PORT || 4000);
const store = await createStore();

const FEATURED_FALLBACK_MAPS: Record<string, GameMapData> = {
  "skyrail-sprint": {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [
      { id: "checkpoint-1", position: { x: 0, y: 2, z: 10 }, label: "Rail 1" },
      { id: "checkpoint-2", position: { x: 0, y: 2, z: 22 }, label: "Rail 2" },
      { id: "checkpoint-3", position: { x: 0, y: 2, z: 34 }, label: "Rail 3" },
    ],
    objects: [
      { id: "object-1", type: "start-pad", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 1, z: 10 }, color: "#4fd1c5", material: "neon", tags: ["spawn"] },
      { id: "object-2", type: "platform", position: { x: 0, y: 2, z: 10 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 8, y: 1, z: 8 }, color: "#5eead4", material: "plastic" },
      { id: "object-3", type: "platform", position: { x: 4, y: 4, z: 22 }, rotation: { x: 0, y: 18, z: 0 }, size: { x: 6, y: 1, z: 6 }, color: "#f2b84b", material: "plastic" },
      { id: "object-4", type: "goal", position: { x: 0, y: 6, z: 36 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 10, y: 1, z: 10 }, color: "#fb7185", material: "neon", tags: ["finish"] },
    ],
  },
  "coin-rush-arena": {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [
      { id: "checkpoint-1", position: { x: -8, y: 2, z: 0 }, label: "West lane" },
      { id: "checkpoint-2", position: { x: 8, y: 2, z: 0 }, label: "East lane" },
    ],
    objects: [
      { id: "object-1", type: "arena", position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 28, y: 1, z: 20 }, color: "#60a5fa", material: "stone" },
      { id: "object-2", type: "pickup", position: { x: -8, y: 2, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 }, color: "#f59e0b", material: "neon", tags: ["collectible"], config: { reward: 1 } },
      { id: "object-3", type: "pickup", position: { x: 8, y: 2, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 2, y: 2, z: 2 }, color: "#34d399", material: "neon", tags: ["collectible"], config: { reward: 1 } },
      { id: "object-4", type: "cover", position: { x: 0, y: 2, z: -6 }, rotation: { x: 0, y: 0, z: 0 }, size: { x: 4, y: 3, z: 2 }, color: "#94a3b8", material: "metal" },
    ],
  },
};

function getFeaturedFallbackDetail(slug: string): PublishedGameDetail | null {
  const fallback = featuredGames.find((item) => item.slug === slug);
  if (!fallback) {
    return null;
  }
  const mapData = FEATURED_FALLBACK_MAPS[slug] ?? {
    spawn: { x: 0, y: 2, z: 0 },
    checkpoints: [],
    objects: [],
  };
  const now = new Date().toISOString();
  return {
    id: fallback.id,
    title: fallback.title,
    slug: fallback.slug,
    description: fallback.description,
    genre: fallback.genre,
    creatorId: "featured-system",
    creatorName: fallback.creatorName,
    createdAt: now,
    updatedAt: now,
    publishedVersionNumber: 1,
    mapData,
    visits: fallback.visits,
    likes: fallback.likes,
  };
}

app.post("/payments/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured on the server." });
    return;
  }
  const signature = String(req.header("stripe-signature") || "").trim();
  if (!signature) {
    res.status(400).json({ error: "Missing Stripe signature." });
    return;
  }
  try {
    const event = verifyStripeWebhookEvent(req.body as Buffer, signature);
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = typeof session.metadata?.orderId === "string" ? session.metadata.orderId : "";
      if (orderId) {
        void store.fulfillCurrencyPurchaseOrder(orderId, session.id).catch((error: unknown) => {
          sendAlert({
            severity: "error",
            title: "❌ Stripe fulfillment failed",
            description: error instanceof Error ? error.message : "Could not fulfill Stripe order.",
            fields: [{ name: "Order", value: orderId, inline: true }],
          });
        });
      }
    }
    res.json({ received: true });
  } catch (error: unknown) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Webhook verification failed." });
  }
});

app.use(cors());
app.use(express.json());

type RateLimitRule = { max: number; windowMs: number };

const ECONOMY_RATE_LIMITS: Record<"trade" | "marketPurchase" | "currencyPurchase", RateLimitRule> = {
  trade: { max: 8, windowMs: 60_000 },
  marketPurchase: { max: 20, windowMs: 60_000 },
  currencyPurchase: { max: 10, windowMs: 60_000 },
};

const economyRateWindow = new Map<string, number[]>();

function getRequestActor(req: Request): string {
  const token = String(req.header("x-session-token") || "").trim();
  if (token) {
    return `token:${token}`;
  }
  return `ip:${req.ip || "unknown"}`;
}

function enforceEconomyRateLimit(req: Request, action: keyof typeof ECONOMY_RATE_LIMITS): boolean {
  const rule = ECONOMY_RATE_LIMITS[action];
  const key = `${action}:${getRequestActor(req)}`;
  const now = Date.now();
  const entries = economyRateWindow.get(key) ?? [];
  const recent = entries.filter((stamp) => now - stamp < rule.windowMs);
  if (recent.length >= rule.max) {
    return false;
  }
  recent.push(now);
  economyRateWindow.set(key, recent);
  return true;
}

function extractIdempotencyKey(req: Request): string | undefined {
  const headerKey = String(req.header("x-idempotency-key") || "").trim();
  const bodyValue = req.body && typeof req.body === "object" ? (req.body as { requestId?: unknown }).requestId : undefined;
  const bodyKey = typeof bodyValue === "string" ? bodyValue.trim() : "";
  const candidate = headerKey || bodyKey;
  if (!candidate) {
    return undefined;
  }
  if (!/^[a-zA-Z0-9._:-]{8,80}$/.test(candidate)) {
    throw new Error("Invalid idempotency key format.");
  }
  return candidate;
}

function statusForEconomyError(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (/invalid session/i.test(message)) {
    return 401;
  }
  if (/not found/i.test(message)) {
    return 404;
  }
  if (/already|do not own|higher than wallet|need \d+ more coins|required|invalid/i.test(message)) {
    return 409;
  }
  return 400;
}

app.get("/health", (_req, res) => {
  const response: ApiHealthResponse = { ok: true, service: "fairblox-api" };
  res.json(response);
});

app.get("/games", (_req, res) => {
  void store
    .listPublishedGames()
    .then((games) => {
      res.json({
        games: games.length > 0 ? games : featuredGames,
      });
    })
    .catch(() => {
      res.status(500).json({
        error: "Could not load games",
      });
    });
});

app.get("/games/:slug", (req, res) => {
  void store
    .getPublishedGameBySlug(req.params.slug)
    .then((game) => {
      if (game) {
        res.json({ game });
        return;
      }
      const fallback = getFeaturedFallbackDetail(req.params.slug);
      if (!fallback) {
        res.status(404).json({ error: "Game not found" });
        return;
      }
      res.json({ game: fallback });
    })
    .catch(() => {
      res.status(500).json({
        error: "Could not load game",
      });
    });
});

app.post("/games/:slug/like", (req, res) => {
  void store
    .likeGame(req.params.slug)
    .then((result) => {
      res.json(result);
    })
    .catch((error: unknown) => {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Could not like game",
      });
    });
});

app.post("/games/:slug/favorite", (req, res) => {
  void store
    .favoriteGame(String(req.header("x-session-token") || ""), req.params.slug)
    .then((result) => {
      res.json(result);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not favorite game";
      const status = /invalid session/i.test(message) ? 401 : 400;
      res.status(status).json({ error: message });
    });
});

app.post("/games/:slug/join", (req, res) => {
  void store
    .joinPublishedGame(req.params.slug)
    .then((session) => {
      res.status(201).json({ session });
    })
    .catch((error: unknown) => {
      const fallback = getFeaturedFallbackDetail(req.params.slug);
      if (fallback) {
        const session: GameSessionSummary = {
          id: randomUUID(),
          gameId: fallback.id,
          gameSlug: fallback.slug,
          gameTitle: fallback.title,
          region: "us-east",
          status: "open",
          playerCount: 1,
          maxPlayers: 12,
          joinedAt: new Date().toISOString(),
          spawn: structuredClone(fallback.mapData.spawn),
        };
        res.status(201).json({ session });
        return;
      }
      res.status(404).json({
        error: error instanceof Error ? error.message : "Could not join game",
      });
    });
});

app.post("/auth/signup", (req, res) => {
  void store
    .signup(req.body as SignupRequest)
    .then((response) => {
      res.status(201).json(response);
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Signup failed",
      });
    });
});

app.post("/auth/login", (req, res) => {
  void store
    .login(req.body as LoginRequest)
    .then((response) => {
      res.json(response);
    })
    .catch((error: unknown) => {
      res.status(401).json({
        error: error instanceof Error ? error.message : "Login failed",
      });
    });
});

app.get("/profiles/:username", (req, res) => {
  void store.getProfileByUsername(req.params.username).then((profile) => {
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    res.json({ profile });
  });
});

app.get("/profiles/:username/games", (req, res) => {
  void store
    .listPublishedGamesByCreator(req.params.username)
    .then((games) => {
      res.json({ games });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not load creator games",
      });
    });
});

app.post("/profiles/:username/follow", (req, res) => {
  void store
    .followCreator(String(req.header("x-session-token") || ""), req.params.username)
    .then((result) => {
      res.json(result);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not follow creator";
      const status = /invalid session/i.test(message) ? 401 : 400;
      res.status(status).json({ error: message });
    });
});

app.get("/me", (req, res) => {
  void store.getProfileFromToken(String(req.header("x-session-token") || "")).then((profile) => {
    if (!profile) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }
    res.json({ profile });
  });
});

app.get("/me/account-state", (req, res) => {
  void store
    .getAccountState(String(req.header("x-session-token") || ""))
    .then((state) => {
      const response: AccountStateResponse = { state };
      res.json(response);
    })
    .catch((error: unknown) => {
      res.status(401).json({
        error: error instanceof Error ? error.message : "Invalid session",
      });
    });
});

app.put("/me/account-state", (req, res) => {
  void store
    .saveAccountState(
      String(req.header("x-session-token") || ""),
      req.body as SaveAccountStateRequest,
    )
    .then((state) => {
      const response: AccountStateResponse = { state };
      res.json(response);
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save account state",
      });
    });
});

app.get("/marketplace/items", (_req, res) => {
  void store
    .listMarketplaceItems()
    .then((items) => {
      res.json({ items });
    })
    .catch(() => {
      res.status(500).json({ error: "Could not load marketplace items" });
    });
});

app.post("/marketplace/items", (req, res) => {
  void store
    .createMarketplaceItem(
      String(req.header("x-session-token") || ""),
      req.body as CreateMarketplaceItemRequest,
    )
    .then((item) => {
      res.status(201).json({ item });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not create marketplace item",
      });
    });
});

app.post("/marketplace/trades", (req, res) => {
  if (!enforceEconomyRateLimit(req, "trade")) {
    sendAlert({
      severity: "warn",
      title: "🚨 Trade rate limit hit",
      description: "A session is being throttled on `/marketplace/trades`.",
      actor: getRequestActor(req),
    });
    res.status(429).json({ error: "Too many trade requests. Please wait a moment and try again." });
    return;
  }
  const requestId = (() => {
    try {
      return extractIdempotencyKey(req);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
      return null;
    }
  })();
  if (requestId === null) {
    return;
  }
  const payload: CreateMarketplaceTradeRequest = {
    ...(req.body as CreateMarketplaceTradeRequest),
    requestId,
  };
  void store
    .tradeMarketplaceLimited(
      String(req.header("x-session-token") || ""),
      payload,
    )
    .then((state) => {
      const response: AccountStateResponse = { state };
      res.json(response);
    })
    .catch((error: unknown) => {
      const status = statusForEconomyError(error);
      const message = error instanceof Error ? error.message : "Could not create trade";
      if (status >= 500 || /invalid session/i.test(message) === false) {
        sendAlert({
          severity: status >= 500 ? "error" : "warn",
          title: status >= 500 ? "❌ Trade server error" : "⚠️ Trade failed",
          description: message,
          actor: getRequestActor(req),
          fields: [{ name: "HTTP Status", value: String(status), inline: true }],
        });
      }
      res.status(status).json({ error: message });
    });
});

app.post("/marketplace/purchase", (req, res) => {
  if (!enforceEconomyRateLimit(req, "marketPurchase")) {
    sendAlert({
      severity: "warn",
      title: "🚨 Purchase rate limit hit",
      description: "A session is being throttled on `/marketplace/purchase`.",
      actor: getRequestActor(req),
    });
    res.status(429).json({ error: "Too many purchase requests. Please wait a moment and try again." });
    return;
  }
  const requestId = (() => {
    try {
      return extractIdempotencyKey(req);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
      return null;
    }
  })();
  if (requestId === null) {
    return;
  }
  const payload: PurchaseMarketplaceItemRequest = {
    ...(req.body as PurchaseMarketplaceItemRequest),
    requestId,
  };
  void store
    .purchaseMarketplaceItem(
      String(req.header("x-session-token") || ""),
      payload,
    )
    .then((state) => {
      const response: AccountStateResponse = { state };
      res.json(response);
    })
    .catch((error: unknown) => {
      const status = statusForEconomyError(error);
      const message = error instanceof Error ? error.message : "Could not purchase marketplace item";
      if (status >= 500) {
        sendAlert({
          severity: "error",
          title: "❌ Marketplace purchase server error",
          description: message,
          actor: getRequestActor(req),
          fields: [{ name: "HTTP Status", value: String(status), inline: true }],
        });
      }
      res.status(status).json({ error: message });
    });
});

app.post("/economy/purchase-currency", (req, res) => {
  if (!enforceEconomyRateLimit(req, "currencyPurchase")) {
    sendAlert({
      severity: "warn",
      title: "🚨 Currency purchase rate limit hit",
      description: "A session is being throttled on `/economy/purchase-currency`.",
      actor: getRequestActor(req),
    });
    res.status(429).json({ error: "Too many currency purchase requests. Please wait a moment and try again." });
    return;
  }
  const requestId = (() => {
    try {
      return extractIdempotencyKey(req);
    } catch (error: unknown) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Invalid request" });
      return null;
    }
  })();
  if (requestId === null) {
    return;
  }
  const payload: PurchaseCurrencyRequest = {
    ...(req.body as PurchaseCurrencyRequest),
    requestId,
  };
  void store
    .purchaseCurrency(
      String(req.header("x-session-token") || ""),
      payload,
    )
    .then((state) => {
      const response: AccountStateResponse = { state };
      res.json(response);
    })
    .catch((error: unknown) => {
      const status = statusForEconomyError(error);
      const message = error instanceof Error ? error.message : "Could not process currency purchase";
      sendAlert({
        severity: status >= 500 ? "error" : "warn",
        title: status >= 500 ? "❌ Currency purchase server error" : "⚠️ Currency purchase failed",
        description: message,
        actor: getRequestActor(req),
        fields: [{ name: "HTTP Status", value: String(status), inline: true }],
      });
      res.status(status).json({ error: message });
    });
});

app.get("/economy/summary", (req, res) => {
  void store
    .getEconomySummary(String(req.header("x-session-token") || ""))
    .then((summary) => {
      const response: EconomySummaryResponse = { summary };
      res.json(response);
    })
    .catch((error: unknown) => {
      res.status(401).json({
        error: error instanceof Error ? error.message : "Could not load economy summary",
      });
    });
});

app.post("/payments/currency/checkout", (req, res) => {
  if (!isStripeConfigured()) {
    res.status(503).json({ error: "Stripe is not configured on the server." });
    return;
  }
  const token = String(req.header("x-session-token") || "");
  void store
    .createCurrencyPurchaseOrder(token, req.body as CurrencyPurchaseCheckoutRequest)
    .then(async (order) => {
      const checkout = await createStripeCurrencyCheckoutSession({
        orderId: order.id,
        userId: order.userId,
        coins: order.coins,
        usdCents: order.usdCents,
        requestId: order.requestId,
      });
      const updatedOrder = await store.attachCurrencyPurchaseOrderCheckout(
        order.id,
        checkout.sessionId,
        checkout.checkoutUrl,
      );
      const response: CurrencyPurchaseCheckoutResponse = { order: updatedOrder };
      res.status(201).json(response);
    })
    .catch((error: unknown) => {
      res.status(/invalid session/i.test(error instanceof Error ? error.message : "") ? 401 : 400).json({
        error: error instanceof Error ? error.message : "Could not create checkout session",
      });
    });
});

app.get("/payments/currency/orders/:orderId", (req, res) => {
  void store
    .getCurrencyPurchaseOrder(String(req.header("x-session-token") || ""), req.params.orderId)
    .then((order) => {
      const response: CurrencyPurchaseOrderResponse = { order };
      res.json(response);
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Could not load purchase order";
      res.status(/invalid session/i.test(message) ? 401 : 404).json({ error: message });
    });
});

app.post("/games", (req, res) => {
  void store
    .createGameDraft(String(req.header("x-session-token") || ""), req.body as CreateGameRequest)
    .then((game) => {
      res.status(201).json({ game });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unable to create game draft",
      });
    });
});

app.get("/me/games", (req, res) => {
  void store
    .listGamesForToken(String(req.header("x-session-token") || ""))
    .then((games) => {
      res.json({ games });
    })
    .catch((error: unknown) => {
      res.status(401).json({
        error: error instanceof Error ? error.message : "Invalid session",
      });
    });
});

app.get("/me/games/:id", (req, res) => {
  void store
    .getGameDraft(String(req.header("x-session-token") || ""), req.params.id)
    .then((game) => {
      res.json({ game });
    })
    .catch((error: unknown) => {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Draft not found",
      });
    });
});

app.put("/me/games/:id/map", (req, res) => {
  void store
    .saveGameMap(String(req.header("x-session-token") || ""), req.params.id, req.body as SaveMapRequest)
    .then((game) => {
      res.json({ game });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not save map",
      });
    });
});

app.post("/me/games/:id/publish", (req, res) => {
  void store
    .publishGame(String(req.header("x-session-token") || ""), req.params.id, req.body as PublishGameRequest)
    .then((game) => {
      res.json({ game });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not publish game",
      });
    });
});

app.post("/me/games/:id/unpublish", (req, res) => {
  void store
    .unpublishGame(String(req.header("x-session-token") || ""), req.params.id)
    .then((game) => {
      res.json({ game });
    })
    .catch((error: unknown) => {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Could not unpublish game",
      });
    });
});

// Global unhandled-rejection guard — catches anything that slips past route handlers.
process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? (reason.stack ?? "") : "";
  sendAlert({
    severity: "error",
    title: "❌ Unhandled server rejection",
    description: message,
    fields: stack ? [{ name: "Stack (truncated)", value: stack.slice(0, 800) }] : [],
  });
  console.error("[unhandledRejection]", reason);
});

app.listen(port, () => {
  console.log(`Fairblox API listening on http://localhost:${port}`);
  sendAlert({
    severity: "info",
    title: "✅ Fairblox API started",
    description: `API is up and listening on port ${port}.`,
    fields: [{ name: "Environment", value: process.env.NODE_ENV ?? "development", inline: true }],
  });
});
