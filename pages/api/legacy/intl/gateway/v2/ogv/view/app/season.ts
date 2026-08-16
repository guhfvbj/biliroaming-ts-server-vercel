import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../../../../src/_config";
import { resinFetch } from "../../../../../../../../../src/utils/resin-fetch";
import { withResinError } from "../../../../../../../../../src/utils/with-resin-error";

const api = env.api.intl.season_info;

const main = async (req: NextApiRequest, res: NextApiResponse) => {
  return resinFetch(api + req.url, {
    method: req.method,
  })
    .then((response) => response.json())
    .then(
      (response: {
        code: number;
        result: {
          modules: {
            episodes: {
              subtitles: {
                id: number;
                is_machine: boolean;
                key: string;
                title: string;
                url: string;
              }[];
            }[];
          }[];
        };
      }) => {
        if (response.code === 0 && env.th_subtitle_api) {
          if (response.result?.modules[0]?.episodes) {
            const episodes = response.result?.modules[0]?.episodes;
            for (const ep of episodes) {
            }
          }
        }
        res.json(response);
      }
    );
};

export default withResinError(main);
