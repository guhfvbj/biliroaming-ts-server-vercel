import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../src/_config";
import { resinFetch } from "../../../../../../src/utils/resin-fetch";
import { withResinError } from "../../../../../../src/utils/with-resin-error";

const api = env.api.main.web.season_info;

const main = async (req: NextApiRequest, res: NextApiResponse) => {
  return resinFetch(api + req.url, {
    method: req.method,
    headers: {
      "User-Agent": env.UA,
    },
  })
    .then((response) => response.json())
    .then((response) => {
      const log = env.logger.child({
        action: "番剧详情(网页端)",
        method: req.method,
        url: req.url,
      });
      log.info({});
      log.debug({ context: response });
      res.json(response);
    });
};

export default withResinError(main);
