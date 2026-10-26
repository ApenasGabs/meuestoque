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

const REDIRECT_URI_REGEX =
  /^(https:\/\/|http:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?(\/.*)?$)/;

/**
 * Valida os parâmetros recebidos na rota /oauth/authorize conforme OAuth 2.1 e PKCE S256.
 */
export const validateAuthorizeParams = (
  params: OAuthAuthorizeParams,
): OAuthValidationResult => {
  if (params.responseType !== "code") {
    return {
      valid: false,
      error: "unsupported_response_type",
      errorDescription: "Apenas o parâmetro response_type='code' é suportado.",
    };
  }

  if (!params.clientId || params.clientId.trim().length === 0) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription: "O parâmetro client_id é obrigatório.",
    };
  }

  if (!params.redirectUri || !REDIRECT_URI_REGEX.test(params.redirectUri)) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "redirect_uri inválido. Deve ser uma URL HTTPS ou localhost para desenvolvimento.",
    };
  }

  if (!params.codeChallenge || params.codeChallenge.length < 40 || params.codeChallenge.length > 128) {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "code_challenge é obrigatório para PKCE e deve ter entre 40 e 128 caracteres.",
    };
  }

  if (params.codeChallengeMethod !== "S256") {
    return {
      valid: false,
      error: "invalid_request",
      errorDescription:
        "code_challenge_method deve ser 'S256'. Métodos não criptográficos (plain) não são aceitos.",
    };
  }

  return { valid: true };
};

/**
 * Invoca a RPC create_mcp_oauth_code no Supabase para gerar o código de autorização seguro.
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
    console.error("[OAuth] Erro ao emitir código:", error?.message);
    throw new Error(error?.message ?? "Falha ao gerar código de autorização");
  }

  return data as string;
};

/**
 * Constrói a URL de redirecionamento anexando os parâmetros passados.
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
