import { supabase } from "./supabase";

export type McpKeyScope = "read" | "write";

export interface McpApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: McpKeyScope[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  revoked_at: string | null;
}

export interface CreatedMcpApiKey {
  id: string;
  apiKey: string;
  keyPrefix: string;
  expiresAt: string;
}

export type McpKeyStatus = "active" | "expiring" | "expired" | "revoked";

const EXPIRING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Lista as chaves MCP do usuario autenticado (sem hash). */
export const listMcpKeys = async (): Promise<McpApiKey[]> => {
  const { data, error } = await supabase
    .from("mcp_api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar chaves MCP");
  return (data ?? []) as McpApiKey[];
};

/** Cria uma chave MCP. O segredo retornado so existe nesta resposta. */
export const createMcpKey = async (
  name: string,
  days: number,
  scopes: McpKeyScope[],
): Promise<CreatedMcpApiKey> => {
  const { data, error } = await supabase.rpc("create_mcp_api_key", {
    p_name: name,
    p_days: days,
    p_scopes: scopes,
  });
  const row = (Array.isArray(data) ? data[0] : null) as
    | { id: string; api_key: string; key_prefix: string; expires_at: string }
    | null;
  if (error || !row) {
    if (error?.message.includes("limit")) throw new Error("Limite de 10 chaves ativas atingido");
    throw new Error("Falha ao criar chave MCP");
  }
  return { id: row.id, apiKey: row.api_key, keyPrefix: row.key_prefix, expiresAt: row.expires_at };
};

/** Revoga uma chave MCP. O efeito e imediato no servidor MCP. */
export const revokeMcpKey = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc("revoke_mcp_api_key", { p_id: id });
  if (error) throw new Error("Falha ao revogar chave MCP");
};

/** Revoga todas as chaves ativas do usuario. */
export const revokeAllMcpKeys = async (): Promise<number> => {
  const { data, error } = await supabase.rpc("revoke_all_mcp_api_keys");
  if (error) throw new Error("Falha ao revogar chaves MCP");
  return typeof data === "number" ? data : 0;
};

export const getMcpKeyStatus = (key: McpApiKey, now: number = Date.now()): McpKeyStatus => {
  if (key.revoked_at) return "revoked";
  const expires = new Date(key.expires_at).getTime();
  if (expires <= now) return "expired";
  if (expires - now <= EXPIRING_WINDOW_MS) return "expiring";
  return "active";
};

export const buildMcpConfig = (serverName: string, url: string, apiKey: string): string =>
  JSON.stringify(
    { mcpServers: { [serverName]: { url, headers: { Authorization: `Bearer ${apiKey}` } } } },
    null,
    2,
  );
