import { createMcpHandler } from "mcp-handler";
import { authenticateRequest } from "../src/mcp/auth";
import { registerListTools } from "../src/mcp/tools/list";
import { registerStockTools } from "../src/mcp/tools/stock";
import { registerInsightTools } from "../src/mcp/tools/insights";

/**
 * Endpoint MCP do MeuEstoque.
 * Suporta Streamable HTTP transport (compatível com qualquer cliente MCP).
 * Autenticação via JWT Supabase no header Authorization.
 */
const handler = createMcpHandler(
  (server) => {
    registerListTools(server);
    registerStockTools(server);
    registerInsightTools(server);
  },
  {
    name: "meuestoque-mcp",
    version: "1.0.0",
  },
  {
    // Middleware de autenticação executado antes de cada tool call
    beforeRequest: async (req) => {
      const authHeader = req.headers.get("Authorization");
      return authenticateRequest(authHeader);
    },
  },
);

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
