// @ts-check

const cache_control = (/** @type {number} */ time) => [
  {
    key: "Cache-Control",
    value: `max-age=${time}, s-maxage=${time}, stale-while-revalidate=${time}`,
  },
  {
    key: "CDN-Cache-Control",
    value: `max-age=${time}`,
  },
  {
    key: "Cloudflare-CDN-Cache-Control",
    value: `max-age=${time}`,
  },
  {
    key: "Vercel-CDN-Cache-Control",
    value: `max-age=${time}`,
  },
];

const no_store_headers = [
  {
    key: "Cache-Control",
    value: "no-store",
  },
];

/**
 * @type {import('next').NextConfig}
 */
const nextConfig = {
  async headers() {
    return [
      {
        source: "/api/bbzq/compat",
        headers: no_store_headers,
      },
      {
        source: "/(.*)",
        headers: cache_control(86400),
      },
      {
        source: "/api/users/(.*)",
        headers: cache_control(86400),
      },
      {
        source: "/pgc/view/v2/app/season(.*)",
        headers: cache_control(86400),
      },
      {
        source: "/pgc/view/web/season(.*)",
        headers: cache_control(86400),
      },
      {
        source: "/x/v2/search/type(.*)",
        headers: cache_control(43200),
      },
      {
        source: "/x/web-interface/search/type(.*)",
        headers: cache_control(43200),
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/pgc/:path(.*)",
        destination: "/api/legacy/pgc/:path*",
      },
      {
        source: "/x/:path(.*)",
        destination: "/api/legacy/x/:path*",
      },
      {
        source: "/intl/:path(.*)",
        destination: "/api/legacy/intl/:path*",
      },
      {
        source: "/api/server_info(.*)",
        destination: "/api/legacy/server_info",
      },
      {
        source: "/bilibili.app.playurl.v1.PlayURL/:path(.*)",
        destination: "/api/legacy/grpc/playurl/:path*",
      },
      {
        source: "/bilibili.pgc.gateway.player.v1.PlayURL/:path(.*)",
        destination: "/api/legacy/grpc/pgc-playurl/:path*",
      },
      {
        source: "/bilibili.pgc.gateway.player.v2.PlayURL/:path(.*)",
        destination: "/api/legacy/grpc/pgc-playurl-v2/:path*",
      },
      {
        source: "/bilibili.community.service.dm.v1.DM/:path(.*)",
        destination: "/api/legacy/grpc/dm/:path*",
      },
      {
        source: "/bilibili.main.community.reply.v1.Reply/:path(.*)",
        destination: "/api/legacy/grpc/reply/:path*",
      },
      {
        source: "/bilibili.main.community.reply.v2.Reply/:path(.*)",
        destination: "/api/legacy/grpc/reply-v2/:path*",
      },
    ];
  },
};

export default nextConfig;
