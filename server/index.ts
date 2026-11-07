import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import mcpHandler from "../api/mcp";
import nfceHandler from "../api/nfce";
import oauthTokenHandler from "../api/oauth/token";
import tendaHandler from "../api/tenda";
import oauthAuthServerHandler from "../api/well-known/oauth-authorization-server";
import oauthProtectedResourceHandler from "../api/well-known/oauth-protected-resource";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "../dist");
const indexHtmlPath = path.join(distDir, "index.html");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

type FetchHandler = (req: Request) => Promise<Response> | Response;

async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const proto = (req.headers["x-forwarded-proto"] as string) || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:3007";
  const url = `${proto}://${host}${req.url || "/"}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }

  const method = req.method || "GET";
  if (method === "GET" || method === "HEAD") {
    return new Request(url, { method, headers });
  }

  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  const body = Buffer.concat(chunks);
  return new Request(url, {
    method,
    headers,
    body: body.length > 0 ? body : undefined,
  });
}

async function sendWebResponse(res: ServerResponse, webRes: Response): Promise<void> {
  res.statusCode = webRes.status;
  webRes.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });

  if (!webRes.body) {
    res.end();
    return;
  }

  const arrayBuffer = await webRes.arrayBuffer();
  res.end(Buffer.from(arrayBuffer));
}

function matchHandler(pathname: string): FetchHandler | null {
  if (
    pathname === "/.well-known/oauth-protected-resource" ||
    pathname === "/api/well-known/oauth-protected-resource"
  ) {
    return oauthProtectedResourceHandler;
  }
  if (
    pathname === "/.well-known/oauth-authorization-server" ||
    pathname === "/api/well-known/oauth-authorization-server"
  ) {
    return oauthAuthServerHandler;
  }
  if (pathname === "/api/oauth/token") {
    return oauthTokenHandler;
  }
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) {
    return mcpHandler;
  }
  if (pathname === "/api/nfce") {
    return nfceHandler;
  }
  if (pathname === "/api/tenda" || pathname.startsWith("/api/tenda/")) {
    return tendaHandler;
  }
  return null;
}

const server = http.createServer(async (req, res) => {
  try {
    const rawUrl = req.url || "/";
    const qIdx = rawUrl.indexOf("?");
    const pathname = decodeURIComponent(qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl);

    if (pathname === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", service: "meuestoque" }));
      return;
    }

    const handler = matchHandler(pathname);
    if (handler) {
      const webReq = await toWebRequest(req);
      const webRes = await handler(webReq);
      await sendWebResponse(res, webRes);
      return;
    }

    if (pathname.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const safeRelPath = pathname.replace(/^\/+/, "");
    const candidatePath = path.resolve(distDir, safeRelPath);
    if (
      safeRelPath &&
      candidatePath.startsWith(distDir) &&
      fs.existsSync(candidatePath) &&
      fs.statSync(candidatePath).isFile()
    ) {
      const ext = path.extname(candidatePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || "application/octet-stream";
      const cacheControl = pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "public, max-age=3600";
      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": cacheControl,
      });
      fs.createReadStream(candidatePath).pipe(res);
      return;
    }

    if (fs.existsSync(indexHtmlPath)) {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(indexHtmlPath).pipe(res);
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Frontend bundle not found");
  } catch (err) {
    console.error("[MeuEstoque Server Error]", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
});

const port = Number(process.env.PORT) || 3007;
server.listen(port, "0.0.0.0", () => {
  console.log(`MeuEstoque server listening on http://0.0.0.0:${port}`);
});
