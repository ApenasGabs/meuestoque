declare const process: { env: Record<string, string | undefined> };
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

export interface AuthenticatedContext {
  supabase: SupabaseClient;
  userId: string;
  groups: { id: string }[];
}

/**
 * Valida o JWT Bearer do header Authorization e retorna um cliente Supabase
 * autenticado com o contexto do usuario. O RLS e ativado automaticamente.
 *
 * @param authHeader - Valor do header Authorization (ex: "Bearer eyJ...")
 * @returns Contexto autenticado com cliente Supabase e userId
 * @throws {Error} Se o token for invalido ou ausente
 */
export const authenticateRequest = async (
  authHeader: string | null,
): Promise<AuthenticatedContext> => {
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Authorization header ausente ou invalido");
  }

  const token = authHeader.slice(7);

  // Cria cliente com o JWT do usuario — ativa RLS automaticamente
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  // Valida o token e recupera o usuario
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error("Token invalido ou expirado");
  }

  // Busca todos os grupos do usuário
  const { data: memberData, error: memberError } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (memberError) {
    console.error("[MCP Auth] Erro ao buscar grupos:", memberError);
    throw new Error("Erro interno ao validar grupos do usuário");
  }

  return {
    supabase,
    userId: user.id,
    groups: memberData ? memberData.map(m => ({ id: m.group_id })) : [],
  };
};
