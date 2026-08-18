import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../src/_config";

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const region = env.bbzq_region;
  if (!env.bbzq_enabled || !region) {
    res.status(404).json({ code: -404, message: "BBZQ compatibility is disabled" });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    code: 0,
    data: {
      protocol: "bbzq-bangumi/1",
      region,
      capabilities:
        region === "intl"
          ? ["search", "season", "playurl", "subtitle", "comments", "danmaku", "grpc-playurl-v1", "grpc-playurl-v2"]
          : ["search", "season", "playurl", "comments", "danmaku", "grpc-playurl-v1", "grpc-playurl-v2"],
    },
  });
}
