import { createMcpHandler } from "mcp-handler";
import { authenticateRequest } from "../src/mcp/auth";
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

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "*" } });
  }

  const authHeader = req.headers.get("Authorization");
  try {
    const context = await authenticateRequest(authHeader);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any).auth = context;
    return await mcp(req);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unauthorized";
    return new Response(JSON.stringify({ error: msg }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}