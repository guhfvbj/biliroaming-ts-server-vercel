// import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { NextApiRequest, NextApiResponse } from "next";
import * as env from "../../../../../../src/_config";
import { resinFetch } from "../../../../../../src/utils/resin-fetch";
import { withResinError } from "../../../../../../src/utils/with-resin-error";

const api = env.api.main.app.search;
const basic_res = {
  area: "漫游",
  badge: "公告",
  badges: [
    {
      bg_color: "#00C0FF",
      bg_color_night: "#0B91BE",
      bg_style: 1,
      text: env.fs_badges,
      text_color: "#FFFFFF",
      text_color_night: "#E5E5E5",
    },
  ],
  cover: env.fs_cover,
  cv: "",
  episodes: [
    { index: "1", param: "1", position: 1, uri: env.fs_watch_button_link },
  ],
  episodes_new: new Function("return" + JSON.stringify(env.fs_episodes_app))(),
  follow_button: {
    icon: "http://i0.hdslb.com/bfs/bangumi/154b6898d2b2c20c21ccef9e41fcf809b518ebb4.png",
    status_report: "bangumi",
    texts: {
      "0": env.fs_follow_button_title,
      "1": env.fs_unfollow_button_title,
    },
  },
  goto: "bangumi",
  is_selection: 1,
  label: env.fs_label,
  media_type: 1,
  param: "1",
  ptime: 1500000000,
  rating: env.fs_rating,
  season_id: 1,
  season_type: 1,
  season_type_name: "番剧",
  selection_style: env.fs_selection_style,
  staff: "无",
  style: env.fs_style,
  styles: env.fs_style,
  title: env.fs_title,
  uri: env.fs_uri,
  vote: env.fs_vote,
  watch_button: {
    link: env.fs_watch_button_link,
    title: env.fs_watch_button_title,
  },
};

// const main = async (req: VercelRequest, res: VercelResponse) => {
const main = async (req: NextApiRequest, res: NextApiResponse) => {
  const query = new URL(req.url || "/", "http://bbzq.invalid").searchParams;
  const type = query.get("type");

  // Convert BBZQ custom type=7 (HK/TW bangumi) to Bilibili's standard type=1 (bangumi/PGC)
  const cleanUrl = new URL(req.url || "/", "http://bbzq.invalid");
  if (type === "7") {
    cleanUrl.searchParams.set("type", "1");  // Use Bilibili's bangumi/PGC search type
    // Add area parameter for HK/TW region
    if (env.bbzq_region) {
      cleanUrl.searchParams.set("area", env.bbzq_region);
    }
    // Add build parameter if not present (required by main API)
    if (!cleanUrl.searchParams.has("build")) {
      cleanUrl.searchParams.set("build", "6400000");
    }
  }

  const upstream = `${api}${cleanUrl.pathname}${cleanUrl.search}`;
  return resinFetch(upstream, {
    method: req.method,
    headers: {
      "User-Agent": env.UA,
    },
  })
    .then((response) => response.json())
    .then((response: { data: { items: Array<object> }; code: number }) => {
      const log = env.logger.child({
        action: "搜索(APP端)",
        method: req.method,
        url: req.url,
      });
      log.info({});
      log.debug({ context: response });
      if (response.code === 0) {
        let m_res = response;
        if (env.fs_enabled === 1) {
          if (m_res.data.items) m_res["data"]["items"].splice(0, 0, basic_res);
          else m_res["data"]["items"] = [basic_res];
        }
        res.json(m_res);
      } else res.json(response);
    });
};

export default withResinError(main);
