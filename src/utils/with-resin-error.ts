import type { NextApiHandler, NextApiRequest, NextApiResponse } from "next";
import { logger } from "../_config";

export const withResinError = (handler: NextApiHandler): NextApiHandler =>
  async (req: NextApiRequest, res: NextApiResponse) => {
    try {
      await handler(req, res);
    } catch (error) {
      logger.error(
        { err: error, method: req.method, url: loggerSanitize(req.url) },
        "Resin upstream request failed"
      );
      if (!res.headersSent) {
        res.status(503).json({
          code: -503,
          message: "Resin upstream unavailable",
        });
      }
    }
  };

const loggerSanitize = (url: string | undefined): string | undefined => {
  if (!url) return url;
  return url.replace(
    /([?&](?:access_key|sign|ts|token|authorization)=)[^&\s]*/gi,
    "$1<redacted>"
  );
};
