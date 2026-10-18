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

/**
 * Lista as chaves MCP ativas, expiradas ou revogadas do usuario autenticado.
 * A consulta nao expoem o hash da chave (`key_hash`).
 *
 * @returns {Promise<McpApiKey[]>} Lista de chaves do usuario ordenadas por criacao decrescente
 * @throws {Error} Se a consulta ao Supabase falhar
 * @example
 * const keys = await listMcpKeys();
 */
export const listMcpKeys = async (): Promise<McpApiKey[]> => {
  const { data, error } = await supabase
    .from("mcp_api_keys")
    .select("id, name, key_prefix, scopes, created_at, last_used_at, expires_at, revoked_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Falha ao carregar chaves MCP");
  return (data ?? []) as McpApiKey[];
};

/**
 * Cria uma nova chave de API para integracoes MCP com escopos e validade customizados.
 * O segredo da chave so e retornado nesta resposta e nunca mais podera ser recuperado.
 *
 * @param {string} name - Nome de identificacao da chave (ex: "Claude Desktop")
 * @param {number} days - Tempo de vida da chave em dias (entre 1 e 365)
 * @param {McpKeyScope[]} scopes - Escopos atribuidos a chave ('read' e/ou 'write')
 * @returns {Promise<CreatedMcpApiKey>} Objeto contendo o ID, o segredo completo e metadados
 * @throws {Error} Se o limite de chaves ativas for atingido ou se os parametros forem invalidos
 * @example
 * const newKey = await createMcpKey("Cursor", 90, ["read", "write"]);
 */
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

/**
 * Revoga imediatamente uma chave MCP ativa do usuario autenticado.
 * O efeito e imediato em todas as requisicoes subsequentes ao servidor MCP.
 *
 * @param {string} id - UUID da chave MCP a ser revogada
 * @returns {Promise<void>}
 * @throws {Error} Se a RPC de revogacao falhar
 * @example
 * await revokeMcpKey("123e4567-e89b-12d3-a456-426614174000");
 */
export const revokeMcpKey = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc("revoke_mcp_api_key", { p_id: id });
  if (error) throw new Error("Falha ao revogar chave MCP");
};

/**
 * Revoga em lote todas as chaves MCP ativas do usuario autenticado.
 *
 * @returns {Promise<number>} Quantidade total de chaves revogadas
 * @throws {Error} Se a RPC de revogacao em massa falhar
 * @example
 * const revokedCount = await revokeAllMcpKeys();
 */
export const revokeAllMcpKeys = async (): Promise<number> => {
  const { data, error } = await supabase.rpc("revoke_all_mcp_api_keys");
  if (error) throw new Error("Falha ao revogar chaves MCP");
  return typeof data === "number" ? data : 0;
};

/**
 * Calcula o status atual de uma chave MCP com base em sua expiracao e revogacao.
 *
 * @param {McpApiKey} key - Registro da chave MCP
 * @param {number} [now=Date.now()] - Timestamp atual em milissegundos para comparacao
 * @returns {McpKeyStatus} Status da chave ('active', 'expiring', 'expired' ou 'revoked')
 * @example
 * const status = getMcpKeyStatus(key);
 */
export const getMcpKeyStatus = (key: McpApiKey, now: number = Date.now()): McpKeyStatus => {
  if (key.revoked_at) return "revoked";
  const expires = new Date(key.expires_at).getTime();
  if (expires <= now) return "expired";
  if (expires - now <= EXPIRING_WINDOW_MS) return "expiring";
  return "active";
};

/**
 * Gera o JSON de configuracao no formato padrao esperado por clientes MCP (ex: Claude Desktop, Cursor).
 *
 * @param {string} serverName - Identificador do servidor na configuracao (ex: "meuestoque")
 * @param {string} url - URL absoluta do endpoint do servidor MCP
 * @param {string} apiKey - Chave de autenticacao completa (token PAT)
 * @returns {string} String JSON formatada com 2 espacos de indentacao
 * @example
 * const jsonConfig = buildMcpConfig("meuestoque", "https://meuestoque.com/api/mcp", "mest_pat_...");
 */
export const buildMcpConfig = (serverName: string, url: string, apiKey: string): string =>
  JSON.stringify(
    { mcpServers: { [serverName]: { url, headers: { Authorization: `Bearer ${apiKey}` } } } },
    null,
    2,
  );
