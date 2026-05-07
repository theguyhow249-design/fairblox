import { randomUUID } from "node:crypto";
import type { OAuthProvider, OAuthProviderStatus } from "@fairblox/types";

type OAuthProviderConfig = {
  provider: OAuthProvider;
  label: string;
  configured: boolean;
  authorizeUrl?: string;
};

const appBaseUrl = (process.env.APP_BASE_URL?.trim() || "http://localhost:5173").replace(/\/+$/, "");
const apiBaseUrl = (process.env.API_BASE_URL?.trim() || "http://localhost:4000").replace(/\/+$/, "");

function buildGoogleConfig(): OAuthProviderConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const redirectUri = (process.env.GOOGLE_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/google/callback`).replace(/\/+$/, "");
  if (!clientId) {
    return { provider: "google", label: "Google", configured: false };
  }
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("prompt", "select_account");
  return { provider: "google", label: "Google", configured: true, authorizeUrl: url.toString() };
}

function buildDiscordConfig(): OAuthProviderConfig {
  const clientId = process.env.DISCORD_CLIENT_ID?.trim() ?? "";
  const redirectUri = (process.env.DISCORD_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/discord/callback`).replace(/\/+$/, "");
  if (!clientId) {
    return { provider: "discord", label: "Discord", configured: false };
  }
  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "identify email");
  url.searchParams.set("prompt", "consent");
  return { provider: "discord", label: "Discord", configured: true, authorizeUrl: url.toString() };
}

function buildAppleConfig(): OAuthProviderConfig {
  const clientId = process.env.APPLE_CLIENT_ID?.trim() ?? "";
  const redirectUri = (process.env.APPLE_REDIRECT_URI?.trim() || `${apiBaseUrl}/auth/oauth/apple/callback`).replace(/\/+$/, "");
  if (!clientId) {
    return { provider: "apple", label: "Apple", configured: false };
  }
  const url = new URL("https://appleid.apple.com/auth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", "name email");
  return { provider: "apple", label: "Apple", configured: true, authorizeUrl: url.toString() };
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

export function createOAuthCallbackRedirect(provider: OAuthProvider, search: URLSearchParams): string {
  const status = search.get("error") ? "error" : search.get("code") ? "pending" : "cancelled";
  const callbackUrl = new URL(`${appBaseUrl}/`);
  callbackUrl.searchParams.set("oauth", provider);
  callbackUrl.searchParams.set("oauth_status", status);
  if (search.get("error")) {
    callbackUrl.searchParams.set("oauth_error", search.get("error") || "provider_error");
  }
  if (status === "pending") {
    callbackUrl.searchParams.set("oauth_notice", "provider-connected");
  }
  return callbackUrl.toString();
}
