import { describe, expect, it, vi } from "vitest";
import {
  buildRedirectUrl,
  requestOAuthCode,
  validateAuthorizeParams,
  type OAuthAuthorizeParams,
} from "./mcpOAuth";
import { supabase } from "./supabase";

vi.mock("./supabase", () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

describe("mcpOAuth Service", () => {
  const validParams: OAuthAuthorizeParams = {
    responseType: "code",
    clientId: "https://claude.ai",
    redirectUri: "https://claude.ai/api/mcp/callback",
    codeChallenge: "E9Melhoa2OwvFrGMTJguCH5rtx64ZW_SoRO83A3yIGo",
    codeChallengeMethod: "S256",
    state: "xyz123",
    scope: "read write",
  };

  describe("validateAuthorizeParams", () => {
    it("valida parâmetros corretos com sucesso", () => {
      const result = validateAuthorizeParams(validParams);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("rejeita response_type diferente de code", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        responseType: "token",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("unsupported_response_type");
    });

    it("rejeita client_id ausente ou vazio", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        clientId: "   ",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_request");
    });

    it("rejeita redirect_uri inseguro (http não-localhost)", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        redirectUri: "http://malicious.com/callback",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_request");
    });

    it("aceita redirect_uri localhost para desenvolvimento", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        redirectUri: "http://localhost:3000/callback",
      });
      expect(result.valid).toBe(true);
    });

    it("rejeita code_challenge ausente ou muito curto", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        codeChallenge: "too-short",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_request");
    });

    it("rejeita code_challenge_method diferente de S256", () => {
      const result = validateAuthorizeParams({
        ...validParams,
        codeChallengeMethod: "plain",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toBe("invalid_request");
    });
  });

  describe("buildRedirectUrl", () => {
    it("anexa parâmetros de consulta à URL de retorno", () => {
      const url = buildRedirectUrl("https://claude.ai/callback", {
        code: "mest_code_123",
        state: "state_abc",
      });
      expect(url).toBe(
        "https://claude.ai/callback?code=mest_code_123&state=state_abc",
      );
    });

    it("preserva parâmetros existentes na URL base", () => {
      const url = buildRedirectUrl("https://claude.ai/callback?existing=1", {
        code: "mest_code_123",
      });
      expect(url).toBe("https://claude.ai/callback?existing=1&code=mest_code_123");
    });
  });

  describe("requestOAuthCode", () => {
    it("chama a RPC create_mcp_oauth_code e retorna o código gerado", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: "mest_code_sample12345678901234567890123456789012",
        error: null,
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      const code = await requestOAuthCode({
        clientId: "https://claude.ai",
        codeChallenge: validParams.codeChallenge ?? "",
        redirectUri: validParams.redirectUri ?? "",
        scopes: ["read", "write"],
      });

      expect(supabase.rpc).toHaveBeenCalledWith("create_mcp_oauth_code", {
        p_client_id: "https://claude.ai",
        p_code_challenge: validParams.codeChallenge,
        p_redirect_uri: validParams.redirectUri,
        p_scopes: ["read", "write"],
      });
      expect(code).toBe("mest_code_sample12345678901234567890123456789012");
    });

    it("lança erro amigável quando a RPC falha", async () => {
      vi.mocked(supabase.rpc).mockResolvedValueOnce({
        data: null,
        error: { message: "active key limit reached" },
      } as unknown as Awaited<ReturnType<typeof supabase.rpc>>);

      await expect(
        requestOAuthCode({
          clientId: "https://claude.ai",
          codeChallenge: validParams.codeChallenge ?? "",
          redirectUri: validParams.redirectUri ?? "",
        }),
      ).rejects.toThrow("active key limit reached");
    });
  });
});
