import { supabase } from "./supabase";

export interface OAuthAuthorizeParams {
  responseType: string | null;
  clientId: string | null;
  redirectUri: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  state: string | null;
  scope: string | null;
}

export interface OAuthValidationResult {
  valid: boolean;
  error?: string;
  errorDescription?: string;
}

/**
 * Valida estritamente se uma URL de redirecionamento e valida e segura.
 * Deve ser parseavel via new URL(), possuir host valido e usar HTTPS
 * ou HTTP estritamente em localhost / 127.0.0.1.
 *
 * @param uri - String da URL de redirecionamento
 * @returns boolean indicando se a URI e aceita
 */
export const isValidRedirectUri = (uri: string | null): boolean => {
  if (!uri || typeof uri !== "string") {
    return false;
  }

  try {
    const parsed = new URL(uri);
    if (parsed.protocol === "https:") {
      return (
        parsed.hostname.length > 0 &&
        !parsed.hostname.includes(" ") &&
        parsed.hostname.includes(".")
      );
    }

    if (parsed.protocol === "http:") {
      return (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname.endsWith(".localhost")
      );
    }

    return false;
  } catch {
    return false;
  }
};

/**
 * Valida os parametros recebidos na rota /oauth/authorize conforme OAuth 2.1 e PKCE S256.
 *
 * @param params - Objeto com os parametros da querystring
 * @returns Resultado contendo valid e eventuais codigos de erro
 */
export const validateAuthorizeParams = (
  params: OAuthAuthorizeParams,
): OAuthValidationResult => {
  if (params.responseType !== "code") {
    return {
      valid: false,
      error: "unsupported_response_type",
      errorDescription: "Apenas o parametro response_type='code' e suportado.",
    };
  }

  if (!params.clientId || params.clientId.trim().length === 0) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription: "O parametro client_id e obrigatorio.",
    };
  }

  if (!isValidRedirectUri(params.redirectUri)) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "redirect_uri invalido. Deve ser uma URL HTTPS valida com dominio ou localhost para desenvolvimento.",
    };
  }

  if (!params.codeChallenge || params.codeChallenge.length < 40 || params.codeChallenge.length > 128) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "code_challenge e obrigatorio para PKCE e deve ter entre 40 e 128 caracteres.",
    };
  }

  if (params.codeChallengeMethod !== "S256") {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "code_challenge_method deve ser 'S256'. Metodos nao criptograficos (plain) nao sao aceitos.",
    };
  }

  return { valid: true };
};

/**
 * Invoca a RPC create_mcp_oauth_code no Supabase para gerar o codigo de autorizacao seguro.
 *
 * @param options - Objeto contendo clientId, codeChallenge, redirectUri e scopes
 * @returns Authorization code emitido
 * @throws {Error} Se a RPC falhar ou retornar erro
 */
export const requestOAuthCode = async (options: {
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  scopes?: string[];
}): Promise<string> => {
  const { data, error } = await supabase.rpc("create_mcp_oauth_code", {
    p_client_id: options.clientId.trim(),
    p_code_challenge: options.codeChallenge.trim(),
    p_redirect_uri: options.redirectUri.trim(),
    p_scopes: options.scopes ?? ["read", "write"],
  });

  if (error || !data) {
    console.error("[OAuth] Erro ao emitir codigo:", error?.message);
    throw new Error(error?.message ?? "Falha ao gerar codigo de autorizacao");
  }

  return data as string;
};

/**
 * Constroi a URL de redirecionamento anexando os parametros passados.
 *
 * @param baseRedirectUri - URL base de redirecionamento
 * @param params - Objeto chave/valor dos parametros a anexar
 * @returns URL final com querystrings combinadas
 */
export const buildRedirectUrl = (
  baseRedirectUri: string,
  params: Record<string, string>,
): string => {
  const url = new URL(baseRedirectUri);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
};
