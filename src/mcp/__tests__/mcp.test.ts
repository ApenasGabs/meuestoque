import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateRequest, McpAuthError } from "../auth";
import { extractWriteContext } from "../context";
import { registerStockTools } from "../tools/stock";

const VALID_KEY = `mest_pat_${"a".repeat(43)}`;

const rpcMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const buildFakeClient = () => ({
  rpc: rpcMock,
  auth: {
    getUser: vi.fn(async (token: string) => {
      if (token === "valid") return { data: { user: { id: "u1" } }, error: null };
      return { data: { user: null }, error: { message: "Invalid" } };
    }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: [{ group_id: "g1" }], error: null }),
  })),
});

beforeEach(() => {
  rpcMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockImplementation(() => buildFakeClient());
});

describe("MCP Auth", () => {
  it("rejects missing header with generic error", async () => {
    await expect(authenticateRequest(null)).rejects.toThrow(McpAuthError);
    await expect(authenticateRequest(null)).rejects.toThrow("Unauthorized");
  });

  it("rejects invalid session token", async () => {
    await expect(authenticateRequest("Bearer invalid")).rejects.toThrow("Unauthorized");
  });

  it("accepts legacy session token with full scopes", async () => {
    const ctx = await authenticateRequest("Bearer valid");
    expect(ctx.userId).toBe("u1");
    expect(ctx.authMethod).toBe("session");
    expect(ctx.scopes).toEqual(["read", "write"]);
  });

  it("rejects malformed api key without calling the database", async () => {
    await expect(authenticateRequest("Bearer mest_pat_short")).rejects.toThrow("Unauthorized");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("rejects revoked or expired api key (exchange returns no row)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(authenticateRequest(`Bearer ${VALID_KEY}`)).rejects.toThrow("Unauthorized");
    expect(rpcMock).toHaveBeenCalledWith("exchange_mcp_api_key", { p_key: VALID_KEY });
  });

  it("exchanges valid api key and uses the short-lived JWT for queries", async () => {
    rpcMock.mockResolvedValue({
      data: [{ access_token: "short.jwt.token", user_id: "u2", scopes: ["read"] }],
      error: null,
    });
    const ctx = await authenticateRequest(`Bearer ${VALID_KEY}`);
    expect(ctx.userId).toBe("u2");
    expect(ctx.authMethod).toBe("api_key");
    expect(ctx.scopes).toEqual(["read"]);
    expect(ctx.groups).toEqual([{ id: "g1" }]);
    const lastCallOptions = createClientMock.mock.calls.at(-1)?.[2] as {
      global: { headers: Record<string, string> };
    };
    expect(lastCallOptions.global.headers.Authorization).toBe("Bearer short.jwt.token");
  });

  it("exchanges valid OAuth token (mest_oa_) correctly", async () => {
    const OAUTH_KEY = `mest_oa_${"b".repeat(43)}`;
    rpcMock.mockResolvedValue({
      data: [{ access_token: "short.jwt.oauth", user_id: "u3", scopes: ["read", "write"] }],
      error: null,
    });
    const ctx = await authenticateRequest(`Bearer ${OAUTH_KEY}`);
    expect(ctx.userId).toBe("u3");
    expect(ctx.authMethod).toBe("api_key");
    expect(rpcMock).toHaveBeenCalledWith("exchange_mcp_api_key", { p_key: OAUTH_KEY });
  });
});

describe("MCP scopes", () => {
  it("blocks write tools for read-only keys", () => {
    const extra = { authInfo: { scopes: ["read"] } };
    expect(() => extractWriteContext(extra)).toThrow("somente leitura");
  });

  it("allows write tools for write keys", () => {
    const extra = { authInfo: { scopes: ["read", "write"] } };
    expect(extractWriteContext(extra)).toBe(extra.authInfo);
  });
});

describe("MCP Tools (Stock)", () => {
  it("registers tools correctly", () => {
    const mockServer = { registerTool: vi.fn() };
    registerStockTools(mockServer as unknown);
    expect(mockServer.registerTool).toHaveBeenCalled();
  });

  it("executes get_stock_items successfully when query succeeds", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ id: "item-1", nome: "Arroz", quantidade: 5 }],
          error: null,
        }),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_stock_items"]({ group_id: "g1", filtro: "todos" }, extra);
    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Arroz");
  });

  it("throws database error in get_stock_items when query fails", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: "connection timeout" },
        }),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    await expect(
      tools["get_stock_items"]({ group_id: "g1", filtro: "todos" }, extra)
    ).rejects.toThrow("Falha ao carregar itens do estoque: connection timeout");
  });

  it("executes consume_stock_item successfully calling consume_stock_fifo with correct parameters", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
    const fakeSupabase = { rpc: rpcMock };

    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["consume_stock_item"](
      { item_id: "99240b13-7904-4f19-9784-60db8893834c", quantidade: 1 },
      extra,
    );

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Consumo registrado com sucesso.");
    expect(rpcMock).toHaveBeenCalledWith("consume_stock_fifo", {
      p_stock_item_id: "99240b13-7904-4f19-9784-60db8893834c",
      p_quantidade: 1,
      p_tipo: "saida",
      p_origem: "quick_consume",
      p_criado_por: "u-test-123",
    });
  });

  it("throws generic error when consume_stock_fifo fails in consume_stock_item", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "item não encontrado" },
    });
    const fakeSupabase = { rpc: rpcMock };

    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    await expect(
      tools["consume_stock_item"](
        { item_id: "99240b13-7904-4f19-9784-60db8893834c", quantidade: 1 },
        extra,
      ),
    ).rejects.toThrow("Falha ao consumir estoque: item não encontrado");
  });

  it("blocks update_stock_item_validity for read-only keys", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn();
    const extra = {
      authInfo: {
        userId: "u-readonly",
        groups: [{ id: "g1" }],
        scopes: ["read"],
        supabase: { rpc: rpcMock },
      },
    };

    await expect(
      tools["update_stock_item_validity"](
        { item_id: "99240b13-7904-4f19-9784-60db8893834c", data_validade: "2026-12-31" },
        extra,
      ),
    ).rejects.toThrow("somente leitura");
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("executes update_stock_item_validity setting expiration date for multiple items", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: { rpc: rpcMock },
      },
    };

    const itemIds = [
      "99240b13-7904-4f19-9784-60db8893834c",
      "11240b13-7904-4f19-9784-60db8893834d",
    ];
    const result = await tools["update_stock_item_validity"](
      { item_ids: itemIds, data_validade: "2027-03-15", nao_aplica: false },
      extra,
    );

    expect(result.content[0].text).toContain("2 itens atualizados");
    expect(result.content[0].text).toContain("2027-03-15");
    expect(rpcMock).toHaveBeenCalledWith("rpc_bulk_update_stock_validity", {
      p_item_ids: itemIds,
      p_data_validade: "2027-03-15",
      p_nao_aplica: false,
    });
  });

  it("executes update_stock_item_validity with nao_aplica: true clearing expiration date", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: { rpc: rpcMock },
      },
    };

    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const result = await tools["update_stock_item_validity"](
      { item_id: itemId, nao_aplica: true, data_validade: "2027-01-01" },
      extra,
    );

    expect(result.content[0].text).toContain("1 item atualizado");
    expect(result.content[0].text).toContain("Não se aplica");
    expect(rpcMock).toHaveBeenCalledWith("rpc_bulk_update_stock_validity", {
      p_item_ids: [itemId],
      p_data_validade: null,
      p_nao_aplica: true,
    });
  });

  it("validates missing item_ids/data_validade and propagates RPC errors in update_stock_item_validity", async () => {
    const tools: Record<string, (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>> = {};
    const mockServer = {
      registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
        tools[name] = handler as (args: Record<string, unknown>, extra: unknown) => Promise<{ content: { type: string; text: string }[] }>;
      }),
    };
    registerStockTools(mockServer as unknown);

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "Sem permissão para item de estoque" },
    });
    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: { rpc: rpcMock },
      },
    };

    await expect(
      tools["update_stock_item_validity"]({ data_validade: "2027-01-01" }, extra),
    ).rejects.toThrow("Informe ao menos um item");

    await expect(
      tools["update_stock_item_validity"](
        { item_id: "99240b13-7904-4f19-9784-60db8893834c", nao_aplica: false },
        extra,
      ),
    ).rejects.toThrow("Informe 'data_validade'");

    await expect(
      tools["update_stock_item_validity"](
        { item_id: "99240b13-7904-4f19-9784-60db8893834c", data_validade: "2026-02-31" },
        extra,
      ),
    ).rejects.toThrow("Data de validade inválida");

    await expect(
      tools["update_stock_item_validity"](
        { item_id: "99240b13-7904-4f19-9784-60db8893834c", data_validade: "2027-01-01" },
        extra,
      ),
    ).rejects.toThrow("Falha ao atualizar validade do estoque: Sem permissão para item de estoque");
  });
});
