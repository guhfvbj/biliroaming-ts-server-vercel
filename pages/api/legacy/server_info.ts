//import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { NextApiRequest, NextApiResponse } from "next";
import { fetch_config_UA, logger } from "../../../src/_config";
import { resinFetch } from "../../../src/utils/resin-fetch";
import { withResinError } from "../../../src/utils/with-resin-error";

const api = "https://api.bilibili.com";

// const main = async (req: VercelRequest, res: VercelResponse) => {
const main = async (req: NextApiRequest, res: NextApiResponse) => {
  logger
    .child({ action: "获取服务器IP", method: req.method, url: req.url })
    .info({});
  return resinFetch(api + "/x/web-interface/zone", fetch_config_UA)
    .then((response) => response.json())
    .then((response) => {
      res.json(response);
    });
};

export default withResinError(main);
