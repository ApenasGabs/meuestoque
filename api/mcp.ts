export const config = {
  runtime: "edge",
};

import { createMcpHandler } from "mcp-handler";
import { authenticateRequest, McpAuthError, type AuthenticatedContext } from "../src/mcp/auth";
import { registerListTools } from "../src/mcp/tools/list";
import { registerStockTools } from "../src/mcp/tools/stock";
import { registerInsightTools } from "../src/mcp/tools/insights";

const mcp = createMcpHandler(
  (server) => {
    registerListTools(server);
    registerStockTools(server);
    registerInsightTools(server);
  },
  {
    name: "meuestoque-mcp",
    version: "1.0.0",
  }
);

const jsonResponse = (
  status: number,
  body: Record<string, string>,
  req?: Request
): Response => {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  };
  if (status === 401) {
    let origin = "https://meuestoque.apenasgabs.dev";
    if (req) {
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      const proto = req.headers.get("x-forwarded-proto") || "https";
      if (host) origin = `${proto}://${host}`;
    }
    headers["WWW-Authenticate"] = `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
  }
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  let context: AuthenticatedContext;
  try {
    context = await authenticateRequest(req.headers.get("Authorization"));
  } catch (err) {
    if (err instanceof McpAuthError) {
      return jsonResponse(401, { error: "Unauthorized" }, req);
    }
    console.error("[MCP] Falha na autenticacao:", err instanceof Error ? err.message : "unknown");
    return jsonResponse(500, { error: "Internal error" }, req);
  }

  (req as Request & { auth: AuthenticatedContext }).auth = context;
  return mcp(req);
};

export default handler;
