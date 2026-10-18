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

const jsonResponse = (status: number, body: Record<string, string>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "WWW-Authenticate": "Bearer" },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  let context: AuthenticatedContext;
  try {
    context = await authenticateRequest(req.headers.get("Authorization"));
  } catch (err) {
    if (err instanceof McpAuthError) {
      return jsonResponse(401, { error: "Unauthorized" });
    }
    console.error("[MCP] Falha na autenticacao:", err instanceof Error ? err.message : "unknown");
    return jsonResponse(500, { error: "Internal error" });
  }

  (req as Request & { auth: AuthenticatedContext }).auth = context;
  return mcp(req);
};

export default handler;
