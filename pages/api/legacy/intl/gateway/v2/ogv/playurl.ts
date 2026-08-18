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

  const response = await resinFetch(env.api.intl.playurl + req.url, {
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
    upstream_status: response.status,
    upstream_content_type: contentType || "unknown",
    upstream_bytes: Buffer.byteLength(body, "utf8"),
    upstream_json: isJson,
    upstream_html: isHtml,
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

const FORWARDED_HEADERS = [
  "build",
  "accept-encoding",
  "platform-from-bbzq",
  "platform-from-biliroaming",
  "x-from-biliroaming",
  "accept",
  "accept-language",
] as const;

const headerValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export default withResinError(main);
