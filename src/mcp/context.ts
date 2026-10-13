import type { AuthenticatedContext } from "./auth";

/**
 * Recupera o contexto autenticado injetado pelo handler MCP em `extra`.
 *
 * @throws {Error} Se o contexto nao estiver presente
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
 * Igual a `extractContext`, mas exige o escopo `write`.
 *
 * @throws {Error} Se a credencial for somente leitura
 */
export const extractWriteContext = (extra: unknown): AuthenticatedContext => {
  const ctx = extractContext(extra);
  if (!ctx.scopes.includes("write")) {
    throw new Error("Esta chave MCP e somente leitura");
  }
  return ctx;
};
