/**
 * Discord の認可レスポンスに付く iss(RFC 9207)で OAuth コールバックが失敗しないこと。
 * auth.ts の実際のプロバイダー設定から、next-auth と同じ処理(parseProviders → openidClient)で
 * openid-client のクライアントを作り、oauthCallback の iss 検査を通す。
 * 外部へは通信しない(トークンの交換先だけローカルのサーバーに差し替える。iss の検査には関係しない)。
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
// next-auth は内部モジュールを package exports で公開していないため、テストに限りファイルを直接読む
import parseProvidersModule from "../node_modules/next-auth/core/lib/providers";
import { openidClient } from "../node_modules/next-auth/core/lib/oauth/client";

vi.mock("@/lib/db/prisma", async () => {
  const helpers = await import("./helpers/fake-prisma");
  return { prisma: helpers.fakePrisma };
});

// auth.ts は読み込み時に環境変数を読むため、先にテスト用の値を入れる(本物の値ではない)
for (const [key, value] of Object.entries({
  DISCORD_CLIENT_ID: "test-discord-client-id",
  DISCORD_CLIENT_SECRET: "test-discord-client-secret",
  TWITTER_CLIENT_ID: "test-twitter-client-id",
  TWITTER_CLIENT_SECRET: "test-twitter-client-secret",
})) {
  vi.stubEnv(key, value);
}

const { authOptions, DISCORD_ISSUER } = await import("@/auth");

type ParseProviders = typeof parseProvidersModule;
// CJS の default export の読み込み方の違いを吸収する
const parseProviders: ParseProviders =
  (parseProvidersModule as unknown as { default?: ParseProviders }).default ?? parseProvidersModule;

type InternalProvider = ReturnType<ParseProviders>["providers"][number];
type OpenidClientOptions = Parameters<typeof openidClient>[0];

const base = "https://clipshare.example/api/auth";
const internalUrl = {
  origin: "https://clipshare.example",
  host: "clipshare.example",
  path: "/api/auth",
  base,
  toString: () => base,
};

let tokenServer: Server;
let tokenUrl = "";

beforeAll(async () => {
  tokenServer = createServer((request, response) => {
    request.resume();
    request.on("end", () => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ access_token: "test-access-token", token_type: "Bearer", expires_in: 3600, scope: "identify email" }));
    });
  });
  await new Promise<void>((resolve) => tokenServer.listen(0, "127.0.0.1", resolve));
  tokenUrl = `http://127.0.0.1:${(tokenServer.address() as AddressInfo).port}/api/oauth2/token`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => tokenServer.close(() => resolve()));
});

function provider(id: string): InternalProvider {
  const { providers } = parseProviders({ providers: authOptions.providers, url: internalUrl });
  const found = providers.find((candidate) => candidate.id === id);
  expect(found).toBeDefined();
  return found as InternalProvider;
}

async function clientFor(internalProvider: InternalProvider) {
  // トークンの交換先だけ差し替える(issuer・認可 URL などはそのまま)
  const withLocalToken = { ...internalProvider, token: { ...internalProvider.token, url: tokenUrl } };
  return openidClient({ provider: withLocalToken } as unknown as OpenidClientOptions);
}

async function discordCallback(params: Record<string, string>, internalProvider = provider("discord")) {
  const client = await clientFor(internalProvider);
  return client.oauthCallback(internalProvider.callbackUrl, { code: "test-code", state: "test-state", ...params }, { state: "test-state" });
}

describe("Discord OAuth callback with iss (RFC 9207)", () => {
  it("configures the Discord issuer from Discord's authorization server metadata", () => {
    expect(DISCORD_ISSUER).toBe("https://discord.com");
    expect(provider("discord").issuer).toBe("https://discord.com");
  });

  it("accepts a callback carrying iss=https://discord.com and exchanges the code", async () => {
    const tokens = await discordCallback({ iss: "https://discord.com" });
    expect(tokens.access_token).toBe("test-access-token");
  });

  it("still accepts a callback without iss (Discord did not always send it)", async () => {
    const tokens = await discordCallback({});
    expect(tokens.access_token).toBe("test-access-token");
  });

  it("rejects a callback whose iss is not Discord (mix-up protection)", async () => {
    await expect(discordCallback({ iss: "https://evil.example" })).rejects.toThrow(/iss mismatch/);
  });

  it("reproduces the production error when the issuer is not configured", async () => {
    const withoutIssuer = { ...provider("discord"), issuer: undefined };
    await expect(discordCallback({ iss: "https://discord.com" }, withoutIssuer)).rejects.toThrow("issuer must be configured on the issuer");
  });
});

describe("other sign-in methods are unchanged", () => {
  it("keeps the providers: Discord, X (OAuth 2.0) and email", () => {
    const { providers } = parseProviders({ providers: authOptions.providers, url: internalUrl });
    expect(providers.map((candidate) => candidate.id)).toEqual(["discord", "twitter", "email"]);
    expect(providers.find((candidate) => candidate.id === "twitter")?.version).toBe("2.0");
  });

  it("X callback without iss still works (X does not advertise authorization_response_iss_parameter_supported)", async () => {
    const twitter = provider("twitter");
    const client = await clientFor(twitter);
    const tokens = await client.oauthCallback(twitter.callbackUrl, { code: "test-code", state: "test-state" }, { state: "test-state" });
    expect(tokens.access_token).toBe("test-access-token");
  });
});
