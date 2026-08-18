import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../../src/_config";
import { resinFetch } from "../../../../../../../src/utils/resin-fetch";
import { withResinError } from "../../../../../../../src/utils/with-resin-error";
// import * as data_parse from "./_data";

const main = async (req: NextApiRequest, res: NextApiResponse) => {
  /* const continue_execute = await data_parse.middleware(
    req.url as string,
    req.headers
  );
  if (continue_execute[0] == false) res.json(env.block(continue_execute[1]));
  else res.json(await data_parse.main(req.url as string)); */
  const forwardedHeaders = new Headers({
    "User-Agent": headerValue(req.headers["user-agent"]) ?? env.UA,
  });
  for (const name of FORWARDED_HEADERS) {
    const value = headerValue(req.headers[name]);
    if (value) forwardedHeaders.set(name, value);
  }

  const requestUrl = new URL(req.url ?? "/api/legacy/intl/gateway/v2/ogv/playurl", "http://bbzq.invalid");
  const originalQuery = Object.fromEntries(requestUrl.searchParams.entries());
  requestUrl.searchParams.delete("area");
  const upstreamPath = requestUrl.pathname.replace(/^\/api\/legacy\/intl(?=\/|$)/, "/intl");
  const forwardedPath = `${upstreamPath}${requestUrl.search}`;
  const response = await resinFetch(env.api.intl.playurl + forwardedPath, {
    method: req.method,
    headers: forwardedHeaders,
  });
  const body = await response.text();
  const contentType = response.headers.get("content-type") ?? "";
  const trimmed = body.trimStart();
  const isHtml = contentType.includes("html") ||
    trimmed.toLowerCase().startsWith("<!doctype html") ||
    trimmed.toLowerCase().startsWith("<html");
  const isJson = contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  const upstreamJson = isJson ? parseJsonObject(body) : null;
  const upstreamCode = typeof upstreamJson?.code === "number" ? upstreamJson.code : null;
  const upstreamMessage = typeof upstreamJson?.message === "string" ? upstreamJson.message : null;
  const errorKind = upstreamCode === 0
    ? "success"
    : upstreamCode === -404
      ? "object_not_found"
      : upstreamCode === -10403 || upstreamMessage?.includes("地区")
        ? "area_limit"
        : upstreamCode === -400
          ? "invalid_request"
          : upstreamCode == null
            ? "non_json"
            : "upstream_error";
  const pathname = (() => {
    try {
      return new URL(req.url ?? "/", "http://bbzq.invalid").pathname;
    } catch {
      return "/api/legacy/intl/gateway/v2/ogv/playurl";
    }
  })();
  env.logger.info({
    action: "国际影视解析",
    method: req.method,
    route: pathname,
    original_query: summarizeQuery(originalQuery),
    forwarded_query: summarizeQuery(Object.fromEntries(requestUrl.searchParams.entries())),
    upstream_status: response.status,
    upstream_content_type: contentType || "unknown",
    upstream_bytes: Buffer.byteLength(body, "utf8"),
    upstream_json: isJson,
    upstream_html: isHtml,
    upstream_code: upstreamCode,
    upstream_message: upstreamMessage,
    upstream_error_kind: errorKind,
  });

  if (!isJson) {
    res.status(502).json({
      code: -502,
      message: "国际影视解析上游返回无效响应",
    });
    return;
  }

  res.status(response.status);
  if (contentType) res.setHeader("Content-Type", contentType);
  res.send(body);
};

const parseJsonObject = (body: string): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(body);
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};

const summarizeQuery = (query: Record<string, string>) => ({
  ep_id: query.ep_id || undefined,
  cid: query.cid || undefined,
  season_id: query.season_id || undefined,
  area: query.area || undefined,
  qn: query.qn || undefined,
  fnval: query.fnval || undefined,
  fnver: query.fnver || undefined,
  fourk: query.fourk || undefined,
  force_host: query.force_host || undefined,
  appkey: query.appkey || undefined,
  build: query.build || undefined,
  mobi_app: query.mobi_app || undefined,
  platform: query.platform || undefined,
  s_locale: query.s_locale || undefined,
  has_access_key: Boolean(query.access_key),
  has_sign: Boolean(query.sign),
  has_ts: Boolean(query.ts),
});

const FORWARDED_HEADERS = [
  "build",
  "accept-encoding",
  "platform-from-bbzq",
  "x-from-bbzq",
  "platform-from-biliroaming",
  "x-from-biliroaming",
  "accept",
  "accept-language",
] as const;

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default withResinError(main);
