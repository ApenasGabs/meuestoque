import type { AuthenticatedContext } from "./auth";

/**
 * Recupera o contexto autenticado injetado pelo handler MCP em `extra`.
 *
 * @param {unknown} extra - Objeto extra fornecido pelo runtime do handler MCP
 * @returns {AuthenticatedContext} Contexto autenticado contendo Supabase client, userId, grupos e escopos
 * @throws {Error} Se o contexto de autenticacao nao for encontrado no objeto extra
 * @example
 * const { supabase, userId } = extractContext(extra);
 */
export const extractContext = (extra: unknown): AuthenticatedContext => {
  const e = extra as Record<string, unknown> | undefined;
  const http = e?.http as Record<string, unknown> | undefined;
  const ctx = (http?.authInfo ?? e?.authInfo ?? e?.auth ?? e?.context) as AuthenticatedContext | undefined;
  if (!ctx) {
    throw new Error("Contexto de autenticacao nao encontrado");
  }
  return ctx;
};

/**
 * Recupera o contexto autenticado e valida rigorosamente a presenca do escopo `write`.
 *
 * @param {unknown} extra - Objeto extra fornecido pelo runtime do handler MCP
 * @returns {AuthenticatedContext} Contexto autenticado com permissao de escrita garantida
 * @throws {Error} Se o contexto nao for encontrado ou se a credencial for somente leitura
 * @example
 * const { supabase } = extractWriteContext(extra);
 */
export const extractWriteContext = (extra: unknown): AuthenticatedContext => {
  const ctx = extractContext(extra);
  if (!ctx.scopes.includes("write")) {
    throw new Error("Esta chave MCP e somente leitura");
  }
  return ctx;
};
