# Resin 三实例源码部署

本部署使用同一份源码和一次构建，启动三个 Next.js 实例。每个实例使用独立的 Resin Platform + Account，所有 Bilibili 请求必须经过 Resin；Resin 不可用时不会直连 Bilibili。Next.js 只绑定回环地址，Nginx 保留 BBZQ 使用的三个公网端口。

## Resin 平台

在 Resin WebUI 或管理 API 中创建以下平台。三个平台都保持主动健康检查、被动熔断、出口探测和粘性租约开启，分配策略选择 `PREFER_LOW_LATENCY`。

| 平台 | `region_filters` | 说明 |
| --- | --- | --- |
| `BiliHK` | `hk`, `mo` | 港澳节点 |
| `BiliTW` | `tw` | 台湾节点 |
| `BiliIntl` | `sg`, `th`, `jp`, `us` | 国际节点；由 Resin 健康检查和测速机制选择可用节点，排除港澳台 |

`BiliIntl` 纳入新加坡、泰国、日本和美国的全部匹配节点，不设置额外延迟门槛；实际播放验证通过后由 Resin 的健康检查、测速和 passive circuit breaker 负责调度和剔除故障节点。香港、澳门、台湾节点不允许进入该平台。

管理 API 使用 Resin 管理 Token，示例请求只展示结构，Token 必须从运行时环境注入：

```bash
export RESIN_ADMIN_TOKEN='<admin-token>'
curl -fsS -H "Authorization: Bearer ${RESIN_ADMIN_TOKEN}" \
  http://<resin-listen-address>:2260/api/v1/platforms
```

创建平台时使用以下核心字段（`sticky_ttl` 可按现有 Resin 策略调整，建议 `24h`）：

```json
{
  "name": "BiliIntl",
  "sticky_ttl": "24h",
  "region_filters": ["sg", "th", "jp", "us"],
  "allocation_policy": "PREFER_LOW_LATENCY",
  "reverse_proxy_miss_action": "REJECT",
  "passive_circuit_breaker_disabled": false
}
```

将示例中的 `name` 和 `region_filters` 替换为 `BiliHK`/`["hk", "mo"]` 与 `BiliTW`/`["tw"]` 后分别创建另外两个平台。平台已存在时使用 PATCH 更新，不要重复创建同名平台。

## 构建

在 Ubuntu 服务器上准备 Node.js 18.17+（推荐 Node 22）和 pnpm。生产环境应使用版本化源码目录和 `current` 软链接，以便回滚：

```bash
id -u biliroaming >/dev/null 2>&1 || sudo useradd --system --home /opt/biliroaming-ts-server-vercel --shell /usr/sbin/nologin biliroaming
sudo install -d -o biliroaming -g biliroaming /opt/biliroaming-ts-server-vercel
sudo install -d -o biliroaming -g biliroaming /opt/biliroaming-ts-server-vercel/releases/<release-id>
# 上传当前已验证的源码到 releases/<release-id>，不要上传 node_modules、.next 或 .git。
sudo -u biliroaming ln -sfn releases/<release-id> /opt/biliroaming-ts-server-vercel/current
cd /opt/biliroaming-ts-server-vercel/current
sudo -u biliroaming pnpm install --frozen-lockfile
sudo -u biliroaming env NODE_OPTIONS=--max-old-space-size=512 pnpm build
```

升级时先在新源码上完成安装和构建，再切换服务；保留上一份源码目录用于回滚。

## 环境文件

复制 `deploy/env/*.env.example` 到 `/etc/biliroaming/`，改成小写实例名，并将文件权限限制为 `0600`：

```bash
sudo install -d -m 0750 -o root -g biliroaming /etc/biliroaming
sudo install -m 0600 -o root -g biliroaming deploy/env/bilihk.env.example /etc/biliroaming/bilihk.env
sudo install -m 0600 -o root -g biliroaming deploy/env/bilitw.env.example /etc/biliroaming/bilitw.env
sudo install -m 0600 -o root -g biliroaming deploy/env/biliintl.env.example /etc/biliroaming/biliintl.env
```

`RESIN_PROXY_URL` 只填写 Resin 地址，不要把 Token 拼进 URL。三个实例的 `RESIN_PLATFORM` 和 `RESIN_ACCOUNT` 必须分别为：

```text
BiliHK / BiliHK
BiliTW / BiliTW
BiliIntl / BiliIntl
```

`RESIN_PROXY_TOKEN` 仅在 Resin 开启代理令牌认证时填写；未启用时保留为空。无论是否使用令牌，应用始终发送 Platform/Account 身份，且不会回退为直连。

三个 Next.js 后端端口为 `127.0.0.1:13101`、`:13102`、`:13103`。公网端口 `3101`、`3102`、`3103` 由 Nginx 分别代理到对应后端，BBZQ 应继续使用这三个公网地址。

## systemd

```bash
sudo install -m 0644 deploy/systemd/biliroaming@.service /etc/systemd/system/biliroaming@.service
sudo systemctl daemon-reload
sudo systemctl enable --now biliroaming@bilihk biliroaming@bilitw biliroaming@biliintl
sudo systemctl status biliroaming@bilihk biliroaming@bilitw biliroaming@biliintl --no-pager
```

安装 Nginx 配置，并在切换前先校验语法：

```bash
sudo install -d -m 0755 /etc/nginx/snippets
sudo install -m 0644 deploy/nginx/biliroaming-proxy.conf /etc/nginx/snippets/biliroaming-proxy.conf
sudo install -m 0644 deploy/nginx/biliroaming.conf /etc/nginx/conf.d/biliroaming.conf
sudo nginx -t
sudo systemctl reload nginx
```

Nginx 对公网监听 `3101`、`3102`、`3103`，并分别代理到本机的 `13101`、`13102`、`13103`。不要把 Resin `2260` 暴露给公网。

## Cloudflare Tunnel 客户端入口

生产环境通过既有 Cloudflare Tunnel 向客户端提供受信任的 HTTPS。BBZQ 应使用以下地址，不要填写服务器 IP 或端口：

| BBZQ 区域 | 地址 | 本机 origin |
| --- | --- | --- |
| 香港 | `https://hk.2513253.xyz` | `http://127.0.0.1:3101` |
| 台湾 | `https://tw.2513253.xyz` | `http://127.0.0.1:3102` |
| 国际 | `https://th.2513253.xyz` | `http://127.0.0.1:3103` |

Tunnel 的远程 ingress 必须保留原有主机名，并将上述三个主机名分别映射到对应 origin。三个 DNS 记录使用同一 Tunnel 的 `<tunnel-id>.cfargotunnel.com` CNAME 且开启代理。Cloudflare 在边缘终止 TLS；应用和 Nginx 无需保存客户端信任的证书。

## 验收与故障切换

```bash
curl -fsS http://127.0.0.1:3101/api/bbzq/compat
curl -fsS http://127.0.0.1:3102/api/bbzq/compat
curl -fsS http://127.0.0.1:3103/api/bbzq/compat
```

兼容接口的 `region` 应依次为 `hk`、`tw`、`intl`，并返回对应能力集合和 `Cache-Control: no-store`。在 Resin 管理面板检查三个平台的 routable node 数量、健康状态、延迟和 Account 租约。连续请求同一实例时，租约应保持稳定；将当前节点置为不可用后，后续请求应由 Resin 选择同平台健康节点。

停止 Resin 或阻断其监听端口后，Bilibili 请求必须失败；确认日志中没有应用直连 Bilibili 的连接。恢复 Resin 后再验证三个实例恢复。
