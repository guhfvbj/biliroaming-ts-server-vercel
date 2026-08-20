import http from "http";
import http2 from "http2";
import tls from "tls";

type GrpcResponse = {
  status: number;
  headers: http2.IncomingHttpHeaders;
  body: Buffer;
};

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required Resin setting: ${name}`);
  return value;
};

const proxyAuthorization = () => {
  const platform = requiredEnv("RESIN_PLATFORM");
  const account = requiredEnv("RESIN_ACCOUNT");
  const token = process.env.RESIN_PROXY_TOKEN?.trim() || "";
  return `Basic ${Buffer.from(`${platform}.${account}:${token}`).toString("base64")}`;
};

const openTunnel = (target: URL): Promise<tls.TLSSocket> =>
  new Promise((resolve, reject) => {
    const proxy = new URL(requiredEnv("RESIN_PROXY_URL"));
    const targetPort = Number(target.port) || 443;
    const request = http.request({
      host: proxy.hostname,
      port: Number(proxy.port) || 80,
      method: "CONNECT",
      path: `${target.hostname}:${targetPort}`,
      agent: false,
      headers: {
        host: `${target.hostname}:${targetPort}`,
        "proxy-authorization": proxyAuthorization(),
      },
    });
    request.once("connect", (response, socket, head) => {
      if (response.statusCode !== 200) {
        socket.destroy();
        reject(new Error(`Resin CONNECT failed with status ${response.statusCode || 0}`));
        return;
      }
      if (head.length > 0) socket.unshift(head);
      const secureSocket = tls.connect({
        socket,
        servername: target.hostname,
        ALPNProtocols: ["h2"],
      });
      secureSocket.once("secureConnect", () => {
        if (secureSocket.alpnProtocol !== "h2") {
          secureSocket.destroy();
          reject(new Error(`Upstream did not negotiate HTTP/2: ${secureSocket.alpnProtocol || "none"}`));
          return;
        }
        resolve(secureSocket);
      });
      secureSocket.once("error", reject);
    });
    request.once("error", reject);
    request.setTimeout(15_000, () => request.destroy(new Error("Resin CONNECT timed out")));
    request.end();
  });

export const frameGrpcMessage = (body: Uint8Array) => {
  if (body.byteLength >= 5) {
    const declared = Buffer.from(body.buffer, body.byteOffset + 1, 4).readUInt32BE(0);
    if ((body[0] === 0 || body[0] === 1) && declared === body.byteLength - 5) {
      return Buffer.from(body);
    }
  }
  const framed = Buffer.allocUnsafe(body.byteLength + 5);
  framed[0] = 0;
  framed.writeUInt32BE(body.byteLength, 1);
  framed.set(body, 5);
  return framed;
};

const concatBytes = (chunks: Uint8Array[]) => {
  const output = Buffer.alloc(chunks.reduce((total, chunk) => total + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
};

export const resinGrpcRequest = async (
  target: string,
  method: string,
  headers: Record<string, string>,
  body?: Uint8Array,
): Promise<GrpcResponse> => {
  const url = new URL(target);
  const socket = await openTunnel(url);
  const session = http2.connect(url.origin, { createConnection: () => socket });
  return await new Promise<GrpcResponse>((resolve, reject) => {
    let settled = false;
    let status = 0;
    let responseHeaders: http2.IncomingHttpHeaders = {};
    const chunks: Uint8Array[] = [];
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      session.close();
      socket.destroy();
      if (error) reject(error);
      else resolve({ status, headers: responseHeaders, body: concatBytes(chunks) });
    };
    session.once("error", finish);
    const request = session.request({
      ":method": method,
      ":scheme": "https",
      ":authority": url.host,
      ":path": `${url.pathname}${url.search}`,
      ...headers,
      "content-type": "application/grpc",
      te: "trailers",
    });
    request.once("response", (incoming) => {
      responseHeaders = incoming;
      status = Number(incoming[":status"]) || 0;
    });
    request.on("data", (chunk) => chunks.push(new Uint8Array(chunk)));
    request.once("trailers", (trailers) => {
      const grpcStatus = String(trailers["grpc-status"] || "0");
      if (grpcStatus !== "0") finish(new Error(`gRPC upstream status ${grpcStatus}`));
    });
    request.once("end", () => finish());
    request.once("error", finish);
    request.setTimeout(20_000, () => request.destroy(new Error("gRPC upstream timed out")));
    request.end(body ? frameGrpcMessage(body) : undefined);
  });
};
