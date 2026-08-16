import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../src/_config";
import { resinFetch } from "../../../../src/utils/resin-fetch";

export const config = {
  api: {
    bodyParser: false,
  },
};

const targets: Record<string, string> = {
  playurl:
    "https://grpc.biliapi.net/api/grpc/bilibili.app.playurl.v1.PlayURL",
  "pgc-playurl":
    "https://app.bilibili.com/api/grpc/bilibili.pgc.gateway.player.v1.PlayURL",
  "pgc-playurl-v2":
    "https://app.bilibili.com/api/grpc/bilibili.pgc.gateway.player.v2.PlayURL",
  dm: "https://app.bilibili.com/api/grpc/bilibili.community.service.dm.v1.DM",
};

const readBody = async (req: NextApiRequest) => {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of req) {
    const bytes = new Uint8Array(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    chunks.push(bytes);
    length += bytes.byteLength;
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
};

const requestHeaders = (req: NextApiRequest) => {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (
      !value ||
      ["host", "connection", "content-length", "proxy-authorization"].includes(
        name.toLowerCase()
      )
    ) {
      continue;
    }
    headers.set(name, Array.isArray(value) ? value.join(", ") : value);
  }
  headers.set("user-agent", headers.get("user-agent") || env.UA);
  return headers;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pathParts = Array.isArray(req.query.path)
    ? [...req.query.path]
    : typeof req.query.path === "string"
    ? [req.query.path]
    : [];
  const route = targets[pathParts.shift() || ""];
  if (!route) {
    res.status(404).json({ code: -404, message: "Unknown gRPC route" });
    return;
  }

  const target = `${route}/${pathParts
    .map((part) => encodeURIComponent(part))
    .join("/")}${new URL(req.url || "/", "http://localhost").search}`;
  const body = ["GET", "HEAD"].includes(req.method || "GET")
    ? undefined
    : await readBody(req);

  try {
    const response = await resinFetch(target, {
      method: req.method,
      headers: requestHeaders(req),
      body,
    });

    response.headers.forEach((value, key) => {
      if (!["connection", "transfer-encoding"].includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });
    res.status(response.status).end(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    env.logger.error({ err: error, target }, "Resin gRPC upstream request failed");
    res.status(503).json({ code: -503, message: "Resin upstream unavailable" });
  }
}
