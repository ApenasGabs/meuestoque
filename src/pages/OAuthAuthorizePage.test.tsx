import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mcpOAuth from "../lib/mcpOAuth";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";
import { OAuthAuthorizePage } from "./OAuthAuthorizePage";

vi.mock("../lib/mcpOAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof mcpOAuth>();
  return {
    ...actual,
    requestOAuthCode: vi.fn(),
  };
});

describe("OAuthAuthorizePage Component", () => {
  const assignSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useSessionStore.setState({ ready: true });
    useAuthStore.setState({ userId: "user-123", userName: "Gabriel" });

    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        assign: assignSpy,
      },
    });
  });

  const renderWithParams = (queryString: string) => {
    return render(
      <MemoryRouter initialEntries={[`/oauth/authorize${queryString}`]}>
        <Routes>
          <Route path="/oauth/authorize" element={<OAuthAuthorizePage />} />
        </Routes>
      </MemoryRouter>,
    );
  };

  const validQuery =
    "?response_type=code" +
    "&client_id=https://claude.ai" +
    "&redirect_uri=https://claude.ai/api/mcp/callback" +
    "&code_challenge=E9Melhoa2OwvFrGMTJguCH5rtx64ZW_SoRO83A3yIGo" +
    "&code_challenge_method=S256" +
    "&state=test_state_123" +
    "&scope=read+write";

  it("exibe spinner enquanto a sessão não estiver pronta", () => {
    useSessionStore.setState({ ready: false });
    renderWithParams(validQuery);

    expect(screen.getByTestId("oauth-loading")).toBeInTheDocument();
  });

  it("exibe aviso e link de login se o usuário não estiver autenticado", () => {
    useAuthStore.setState({ userId: null, userName: null });
    renderWithParams(validQuery);

    expect(screen.getByTestId("oauth-unauthenticated")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-login-link")).toBeInTheDocument();
  });

  it("exibe mensagem de erro se parâmetros obrigatórios forem inválidos", () => {
    // Falta code_challenge e response_type é inválido
    renderWithParams("?response_type=token");

    expect(screen.getByTestId("oauth-invalid-params")).toBeInTheDocument();
    expect(
      screen.getByText(/Parâmetros de autorização inválidos/i),
    ).toBeInTheDocument();
  });

  it("renderiza tela de consentimento com detalhes da aplicação e escopos", () => {
    renderWithParams(validQuery);

    expect(screen.getByTestId("oauth-authorize-page")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-client-name")).toHaveTextContent("https://claude.ai");
    expect(screen.getByTestId("oauth-user-email")).toHaveTextContent("Gabriel");
    expect(screen.getByText(/Leitura de estoque e compras/i)).toBeInTheDocument();
    expect(screen.getByText(/Gerenciamento de estoque e compras/i)).toBeInTheDocument();
    expect(screen.getByTestId("oauth-authorize-button")).toBeInTheDocument();
    expect(screen.getByTestId("oauth-deny-button")).toBeInTheDocument();
  });

  it("redireciona para o callback com error=access_denied ao clicar em Cancelar", () => {
    renderWithParams(validQuery);

    fireEvent.click(screen.getByTestId("oauth-deny-button"));

    expect(assignSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://claude.ai/api/mcp/callback"),
    );
    expect(assignSpy).toHaveBeenCalledWith(
      expect.stringContaining("error=access_denied"),
    );
    expect(assignSpy).toHaveBeenCalledWith(
      expect.stringContaining("state=test_state_123"),
    );
  });

  it("solicita código via RPC e redireciona com code e state ao clicar em Autorizar", async () => {
    vi.mocked(mcpOAuth.requestOAuthCode).mockResolvedValueOnce(
      "mest_code_sample12345678901234567890123456789012",
    );

    renderWithParams(validQuery);

    fireEvent.click(screen.getByTestId("oauth-authorize-button"));

    await waitFor(() => {
      expect(mcpOAuth.requestOAuthCode).toHaveBeenCalledWith({
        clientId: "https://claude.ai",
        codeChallenge: "E9Melhoa2OwvFrGMTJguCH5rtx64ZW_SoRO83A3yIGo",
        redirectUri: "https://claude.ai/api/mcp/callback",
        scopes: ["read", "write"],
      });
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("https://claude.ai/api/mcp/callback"),
      );
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("code=mest_code_sample12345678901234567890123456789012"),
      );
      expect(assignSpy).toHaveBeenCalledWith(
        expect.stringContaining("state=test_state_123"),
      );
    });
  });

  it("exibe alerta de erro se a chamada RPC falhar ao autorizar", async () => {
    vi.mocked(mcpOAuth.requestOAuthCode).mockRejectedValueOnce(
      new Error("Limite de chaves atingido"),
    );

    renderWithParams(validQuery);

    fireEvent.click(screen.getByTestId("oauth-authorize-button"));

    await waitFor(() => {
      expect(screen.getByText("Limite de chaves atingido")).toBeInTheDocument();
    });
  });
});
