import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionBootstrap } from "../SessionBootstrap";
import { syncBrandDictionaryFromSupabase } from "../../services/brandDictionaryService";
import { supabase } from "../../lib/supabase";

vi.mock("../../services/brandDictionaryService", () => ({
  syncBrandDictionaryFromSupabase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../lib/webData", () => ({
  restoreGroupContext: vi.fn().mockResolvedValue({
    groups: [],
    group: null,
    listId: null,
  }),
}));

vi.mock("../../ComprasWebShell", () => ({
  ComprasWebShell: () => <div data-testid="web-shell">ComprasWebShell</div>,
}));

describe("SessionBootstrap", () => {
  let authCallback: ((event: string, session: unknown) => void) | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = null;

    vi.spyOn(supabase.auth, "onAuthStateChange").mockImplementation((callback) => {
      authCallback = callback as (event: string, session: unknown) => void;
      return {
        data: {
          subscription: {
            unsubscribe: vi.fn(),
            id: "sub-1",
            callback: callback as never,
          },
        },
      };
    });
  });

  it("nao deve disparar sincronizacao de marcas quando nao ha usuario autenticado", () => {
    render(<SessionBootstrap />);

    expect(authCallback).not.toBeNull();
    // Simula evento inicial sem sessão
    act(() => {
      authCallback!("INITIAL_SESSION", null);
    });

    expect(syncBrandDictionaryFromSupabase).not.toHaveBeenCalled();
  });

  it("deve disparar sincronizacao de marcas quando o usuario esta autenticado", () => {
    render(<SessionBootstrap />);

    expect(authCallback).not.toBeNull();
    act(() => {
      authCallback!("SIGNED_IN", {
        user: {
          id: "user-123",
          email: "teste@example.com",
        },
      });
    });

    expect(syncBrandDictionaryFromSupabase).toHaveBeenCalledTimes(1);
  });

  it("nao deve re-disparar sincronizacao no mesmo usuario em refresh de token", () => {
    render(<SessionBootstrap />);

    expect(authCallback).not.toBeNull();
    // Primeiro evento: Login
    act(() => {
      authCallback!("SIGNED_IN", {
        user: {
          id: "user-123",
          email: "teste@example.com",
        },
      });
    });
    expect(syncBrandDictionaryFromSupabase).toHaveBeenCalledTimes(1);

    // Segundo evento: TOKEN_REFRESHED para o mesmo usuário
    act(() => {
      authCallback!("TOKEN_REFRESHED", {
        user: {
          id: "user-123",
          email: "teste@example.com",
        },
      });
    });
    // Não deve disparar de novo
    expect(syncBrandDictionaryFromSupabase).toHaveBeenCalledTimes(1);
  });

  it("deve sincronizar novamente se o usuario autenticado mudar", () => {
    render(<SessionBootstrap />);

    expect(authCallback).not.toBeNull();
    // Usuário 1
    act(() => {
      authCallback!("SIGNED_IN", {
        user: {
          id: "user-1",
          email: "user1@example.com",
        },
      });
    });
    expect(syncBrandDictionaryFromSupabase).toHaveBeenCalledTimes(1);

    // Troca para Usuário 2
    act(() => {
      authCallback!("SIGNED_IN", {
        user: {
          id: "user-2",
          email: "user2@example.com",
        },
      });
    });
    expect(syncBrandDictionaryFromSupabase).toHaveBeenCalledTimes(2);
  });
});
