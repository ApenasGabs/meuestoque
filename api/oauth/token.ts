export const config = {
  runtime: "edge",
};

declare const process: { env: Record<string, string | undefined> };
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

const jsonResponse = (
  status: number,
  body: Record<string, unknown>,
  extraHeaders: Record<string, string> = {}
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      "Access-Control-Allow-Origin": "*",
      ...extraHeaders,
    },
  });

interface ExchangeResult {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, { error: "invalid_request", error_description: "Method not allowed" });
  }

  let grantType = "";
  let code = "";
  let codeVerifier = "";
  let redirectUri = "";
  let clientId = "";

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    const params = new URLSearchParams(text);
    grantType = params.get("grant_type") ?? "";
    code = params.get("code") ?? "";
    codeVerifier = params.get("code_verifier") ?? "";
    redirectUri = params.get("redirect_uri") ?? "";
    clientId = params.get("client_id") ?? "";
  } else if (contentType.includes("application/json")) {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      grantType = String(json.grant_type ?? "");
      code = String(json.code ?? "");
      codeVerifier = String(json.code_verifier ?? "");
      redirectUri = String(json.redirect_uri ?? "");
      clientId = String(json.client_id ?? "");
    } catch {
      return jsonResponse(400, { error: "invalid_request", error_description: "Malformed JSON" });
    }
  } else {
    const text = await req.text();
    const params = new URLSearchParams(text);
    grantType = params.get("grant_type") ?? "";
    code = params.get("code") ?? "";
    codeVerifier = params.get("code_verifier") ?? "";
    redirectUri = params.get("redirect_uri") ?? "";
    clientId = params.get("client_id") ?? "";
  }

  if (grantType !== "authorization_code") {
    return jsonResponse(400, {
      error: "unsupported_grant_type",
      error_description: "Only authorization_code grant type is supported",
    });
  }

  if (!code || !codeVerifier || !redirectUri) {
    return jsonResponse(400, {
      error: "invalid_request",
      error_description: "Missing required parameters (code, code_verifier, redirect_uri)",
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase.rpc("exchange_mcp_oauth_code", {
      p_code: code,
      p_code_verifier: codeVerifier,
      p_redirect_uri: redirectUri,
      p_client_id: clientId || null,
    });

    if (error) {
      console.error("[OAuth Token] RPC Error:", error.message);
      return jsonResponse(500, {
        error: "server_error",
        error_description: "Database error during token exchange",
      });
    }

    const rows = data as ExchangeResult[] | null;
    const row = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;

    if (!row || !row.access_token) {
      return jsonResponse(400, {
        error: "invalid_grant",
        error_description: "Authorization code invalid, expired, or PKCE verifier mismatch",
      });
    }

    return jsonResponse(200, {
      access_token: row.access_token,
      token_type: row.token_type || "Bearer",
      expires_in: row.expires_in,
      scope: row.scope,
    });
  } catch (err) {
    console.error("[OAuth Token] Exception:", err instanceof Error ? err.message : "unknown");
    return jsonResponse(500, { error: "server_error", error_description: "Internal server error" });
  }
}
