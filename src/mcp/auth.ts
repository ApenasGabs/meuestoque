declare const process: { env: Record<string, string | undefined> };
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

export const MCP_KEY_PATTERN = /^mest_(pat|oa)_[A-Za-z0-9_-]{43}$/;

export type McpScope = "read" | "write";

export interface AuthenticatedContext {
  supabase: SupabaseClient;
  userId: string;
  groups: { id: string }[];
  scopes: McpScope[];
  authMethod: "api_key" | "session";
}

/** Erro de autenticacao cuja mensagem e segura para o cliente. */
export class McpAuthError extends Error {}

interface ExchangeRow {
  access_token: string;
  user_id: string;
  scopes: McpScope[];
}

const buildClient = (accessToken: string): SupabaseClient =>
  createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

const authenticateApiKey = async (
  apiKey: string,
): Promise<{ supabase: SupabaseClient; userId: string; scopes: McpScope[] }> => {
  if (!MCP_KEY_PATTERN.test(apiKey)) {
    throw new McpAuthError("Unauthorized");
  }

  const anon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.rpc("exchange_mcp_api_key", { p_key: apiKey });
  const row = (Array.isArray(data) ? data[0] : null) as ExchangeRow | null;

  if (error || !row?.access_token) {
    if (error) console.error("[MCP Auth] Falha na troca da chave:", error.code);
    throw new McpAuthError("Unauthorized");
  }

  return { supabase: buildClient(row.access_token), userId: row.user_id, scopes: row.scopes };
};

/** @deprecated Fluxo legado com JWT de sessao (expira em 1h). Use chaves `mest_pat_`. */
const authenticateSession = async (
  token: string,
): Promise<{ supabase: SupabaseClient; userId: string; scopes: McpScope[] }> => {
  const supabase = buildClient(token);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new McpAuthError("Unauthorized");
  }
  return { supabase, userId: user.id, scopes: ["read", "write"] };
};

/**
 * Autentica uma requisicao MCP. Aceita chave persistente (`mest_pat_...`),
 * trocada por um JWT de 5 minutos no Postgres, ou JWT de sessao (legado).
 * Em ambos os casos as queries rodam como `authenticated`, com RLS ativo.
 *
 * @param authHeader - Valor do header Authorization
 * @returns Contexto autenticado
 * @throws {McpAuthError} Se a credencial for ausente, invalida, expirada ou revogada
 */
export const authenticateRequest = async (
  authHeader: string | null,
): Promise<AuthenticatedContext> => {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new McpAuthError("Unauthorized");
  }

  const token = authHeader.slice(7).trim();
  const isApiKey = token.startsWith("mest_pat_") || token.startsWith("mest_oa_");
  const { supabase, userId, scopes } = isApiKey
    ? await authenticateApiKey(token)
    : await authenticateSession(token);

  const { data: memberData, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (memberError) {
    console.error("[MCP Auth] Erro ao buscar grupos:", memberError.code);
    throw new Error("Erro interno ao validar grupos do usuario");
  }

  return {
    supabase,
    userId,
    groups: memberData ? memberData.map((m) => ({ id: m.group_id as string })) : [],
    scopes,
    authMethod: isApiKey ? "api_key" : "session",
  };
};
