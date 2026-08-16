import { ProxyAgent } from "undici";

type ResinFetchInit = RequestInit & {
  dispatcher?: unknown;
};

const BILIBILI_HOSTS = new Set([
  "api.bilibili.com",
  "app.bilibili.com",
  "passport.bilibili.com",
  "www.bilibili.com",
  "app.biliintl.com",
  "passport.biliintl.com",
  "grpc.biliapi.net",
]);

let proxyAgent: ProxyAgent | undefined;
const RETRYABLE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_RESIN_ATTEMPTS = 3;

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required Resin setting: ${name}`);
  }
  return value;
};

const optionalEnv = (name: string) => process.env[name]?.trim() ?? "";

const getProxyAgent = () => {
  if (proxyAgent) return proxyAgent;

  const proxyUrl = requiredEnv("RESIN_PROXY_URL");
  const platform = requiredEnv("RESIN_PLATFORM");
  const account = requiredEnv("RESIN_ACCOUNT");
  // Resin may be configured without a proxy token. The platform/account
  // identity is still always sent and there is no direct-connect fallback.
  const token = optionalEnv("RESIN_PROXY_TOKEN");
  const parsed = new URL(proxyUrl);

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("RESIN_PROXY_URL must use http or https");
  }
  if (parsed.username || parsed.password) {
    throw new Error("RESIN_PROXY_URL must not contain credentials");
  }

  const identity = `${platform}.${account}:${token}`;
  proxyAgent = new ProxyAgent({
    uri: parsed.origin,
    token: `Basic ${Buffer.from(identity).toString("base64")}`,
  });
  return proxyAgent;
};

const getUrl = (input: RequestInfo | URL) =>
  new URL(typeof input === "string" ? input : input instanceof URL ? input : input.url);

const assertBilibiliUrl = (url: URL) => {
  if (!BILIBILI_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing non-Bilibili upstream: ${url.hostname}`);
  }
};

const requestMethod = (input: RequestInfo | URL, init: ResinFetchInit) =>
  (init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

const retryDelay = (attempt: number) =>
  new Promise((resolve) => setTimeout(resolve, attempt * 200));

/**
 * Sends a Bilibili upstream request through the configured Resin platform.
 * There is intentionally no direct-connect fallback.
 */
export const resinFetch = async (
  input: RequestInfo | URL,
  init: ResinFetchInit = {}
) => {
  const url = getUrl(input);
  assertBilibiliUrl(url);

  const headers = new Headers(init.headers);
  headers.delete("proxy-authorization");

  const method = requestMethod(input, init);
  const attempts = RETRYABLE_METHODS.has(method) ? MAX_RESIN_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(input, {
        ...init,
        headers,
        dispatcher: getProxyAgent(),
      } as RequestInit & { dispatcher: ProxyAgent });
    } catch (error) {
      if (attempt === attempts) throw error;
      await retryDelay(attempt);
    }
  }

  throw new Error("Resin retry loop exited unexpectedly");
};
