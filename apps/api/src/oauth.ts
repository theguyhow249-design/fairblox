import { randomUUID } from "node:crypto";
import type { OAuthProvider, OAuthProviderStatus } from "@fairblox/types";

type OAuthProviderConfig = {
  provider: OAuthProvider;
  label: string;
  configured: boolean;
  authorizeUrl?: string;
  redirectUri: string;
  clientId?: string;
  clientSecret?: string;
};

type OAuthIdentity = {
  provider: OAuthProvider;
  providerUserId: string;
  email: string;
  displayName: string;
  usernameHint?: string;
};

const appBaseUrl = (process.env.APP_BASE_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");
const apiBaseUrl = (process.env.API_BASE_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

function base64UrlDecode(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64").toString("utf8");
}

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT payload.");
  }
  return JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;
}

function buildGoogleConfig(): OAuthProviderConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/google/callback`).replace(/\/+$/, "");
  if (!clientId || !clientSecret) {
    return { provider: "google", label: "Google", configured: false, redirectUri };
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  return { provider: "google", label: "Google", configured: true, authorizeUrl: url.toString(), redirectUri, clientId, clientSecret };
}

function buildDiscordConfig(): OAuthProviderConfig {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = (process.env.DISCORD_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/discord/callback`).replace(/\/+$/, "");
  if (!clientId || !clientSecret) {
    return { provider: "discord", label: "Discord", configured: false, redirectUri };
  }
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("prompt", "consent");
  return { provider: "discord", label: "Discord", configured: true, authorizeUrl: url.toString(), redirectUri, clientId, clientSecret };
}

function buildAppleConfig(): OAuthProviderConfig {
  const clientId = process.env.APPLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.APPLE_CLIENT_SECRET?.trim() ?? "";
  const redirectUri = (process.env.APPLE_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/apple/callback`).replace(/\/+$/, "");
  if (!clientId || !clientSecret) {
    return { provider: "apple", label: "Apple", configured: false, redirectUri };
  }
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "name email");
  return { provider: "apple", label: "Apple", configured: true, authorizeUrl: url.toString(), redirectUri, clientId, clientSecret };
}

function getProviderConfig(provider: OAuthProvider): OAuthProviderConfig {
  switch (provider) {
    case "google":
      return buildGoogleConfig();
    case "discord":
      return buildDiscordConfig();
    case "apple":
      return buildAppleConfig();
  }
}

export function listOAuthProviders(): OAuthProviderStatus[] {
  return (["google", "discord", "apple"] as const).map((provider) => {
    const config = getProviderConfig(provider);
    return {
      provider,
      configured: config.configured,
      label: config.label,
    };
  });
}

export function createOAuthStartUrl(provider: OAuthProvider): string {
  const config = getProviderConfig(provider);
  if (!config.configured || !config.authorizeUrl) {
    throw new Error(`${config.label} OAuth is not configured on the server.`);
  }
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("state", randomUUID());
  return url.toString();
}

async function exchangeGoogleCode(code: string, config: OAuthProviderConfig): Promise<OAuthIdentity> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId || "",
      client_secret: config.clientSecret || "",
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("Google token exchange failed.");
  }
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Google did not return an access token.");
  }
  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userResponse.ok) {
    throw new Error("Google userinfo lookup failed.");
  }
  const user = await userResponse.json() as { sub?: string; email?: string; name?: string; given_name?: string };
  if (!user.sub || !user.email) {
    throw new Error("Google user profile is missing required fields.");
  }
  return {
    provider: "google",
    providerUserId: user.sub,
    email: user.email,
    displayName: user.name || user.given_name || user.email.split("@")[0],
    usernameHint: user.email.split("@")[0],
  };
}

async function exchangeDiscordCode(code: string, config: OAuthProviderConfig): Promise<OAuthIdentity> {
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId || "",
      client_secret: config.clientSecret || "",
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("Discord token exchange failed.");
  }
  const tokenData = await tokenResponse.json() as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error("Discord did not return an access token.");
  }
  const userResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  if (!userResponse.ok) {
    throw new Error("Discord user lookup failed.");
  }
  const user = await userResponse.json() as {
    id?: string;
    email?: string;
    username?: string;
    global_name?: string | null;
  };
  if (!user.id || !user.email) {
    throw new Error("Discord user profile is missing required fields.");
  }
  return {
    provider: "discord",
    providerUserId: user.id,
    email: user.email,
    displayName: user.global_name || user.username || user.email.split("@")[0],
    usernameHint: user.username || user.email.split("@")[0],
  };
}

async function exchangeAppleCode(code: string, config: OAuthProviderConfig): Promise<OAuthIdentity> {
  const tokenResponse = await fetch("https://appleid.apple.com/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId || "",
      client_secret: config.clientSecret || "",
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error("Apple token exchange failed.");
  }
  const tokenData = await tokenResponse.json() as { id_token?: string };
  if (!tokenData.id_token) {
    throw new Error("Apple did not return an identity token.");
  }
  const payload = decodeJwtPayload(tokenData.id_token);
  const sub = typeof payload.sub === "string" ? payload.sub : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  if (!sub || !email) {
    throw new Error("Apple identity token is missing required fields.");
  }
  return {
    provider: "apple",
    providerUserId: sub,
    email,
    displayName: email.split("@")[0],
    usernameHint: email.split("@")[0],
  };
}

export async function exchangeOAuthCode(provider: OAuthProvider, code: string): Promise<OAuthIdentity> {
  const config = getProviderConfig(provider);
  if (!config.configured) {
    throw new Error(`${config.label} OAuth is not configured on the server.`);
  }
  if (!code.trim()) {
    throw new Error("Missing OAuth authorization code.");
  }
  switch (provider) {
    case "google":
      return exchangeGoogleCode(code, config);
    case "discord":
      return exchangeDiscordCode(code, config);
    case "apple":
      return exchangeAppleCode(code, config);
  }
}

export function createOAuthClientRedirect(input: {
  provider: OAuthProvider;
  status: "success" | "error" | "cancelled";
  token?: string;
  error?: string;
}): string {
  const callbackUrl = new URL(`${appBaseUrl}/`);
  callbackUrl.searchParams.set("oauth", input.provider);
  callbackUrl.searchParams.set("oauth_status", input.status);
  if (input.token) {
    callbackUrl.searchParams.set("auth_token", input.token);
  }
  if (input.error) {
    callbackUrl.searchParams.set("oauth_error", input.error);
  }
  return callbackUrl.toString();
}
