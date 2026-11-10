import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateRequest, McpAuthError, resolveGroupId } from "../auth";
import { extractWriteContext } from "../context";
import { registerStockTools, computeStockNameSimilarity } from "../tools/stock";
import { registerInsightTools } from "../tools/insights";

const VALID_KEY = `mest_pat_${"a".repeat(43)}`;

const rpcMock = vi.fn();
const createClientMock = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

const buildFakeClient = (
  memberRows: Record<string, unknown>[] = [{ group_id: "g1" }],
) => ({
  rpc: rpcMock,
  auth: {
    getUser: vi.fn(async (token: string) => {
      if (token === "valid") return { data: { user: { id: "u1" } }, error: null };
      return { data: { user: null }, error: { message: "Invalid" } };
    }),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ data: memberRows, error: null }),
  })),
});

beforeEach(() => {
  rpcMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockImplementation(() => buildFakeClient());
});

describe("MCP Auth & Friendly Group Resolution", () => {
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

  it("loads group names from groups(id, nome) join in authenticateRequest", async () => {
    createClientMock.mockImplementation(() =>
      buildFakeClient([
        { group_id: "g1", groups: { id: "g1", nome: "Casa Principal" } },
        { group_id: "g2", groups: [{ id: "g2", nome: "Chácara" }] },
      ]),
    );
    const ctx = await authenticateRequest("Bearer valid");
    expect(ctx.groups).toEqual([
      { id: "g1", nome: "Casa Principal" },
      { id: "g2", nome: "Chácara" },
    ]);
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

  it("resolves group by UUID or case-insensitive/accent-insensitive name and lists clear names on ambiguity", () => {
    const groups = [
      { id: "11111111-1111-4111-8111-111111111111", nome: "Casa Principal" },
      { id: "22222222-2222-4222-8222-222222222222", nome: "Chácara da Família" },
    ];

    // Sem group_id quando há múltiplos grupos -> erro claro com os nomes
    const ambiguous = resolveGroupId(groups);
    expect(ambiguous.groupId).toBeUndefined();
    expect(ambiguous.error).toContain("Múltiplos grupos encontrados");
    expect(ambiguous.error).toContain("Casa Principal");
    expect(ambiguous.error).toContain("Chácara da Família");

    // Resolução por nome case-insensitive e sem acento
    expect(resolveGroupId(groups, "casa principal").groupId).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
    expect(resolveGroupId(groups, "chacara da familia").groupId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );

    // Resolução por UUID
    expect(resolveGroupId(groups, "22222222-2222-4222-8222-222222222222").groupId).toBe(
      "22222222-2222-4222-8222-222222222222",
    );

    // Múltiplos grupos com o mesmo nome (ambiguidade de nome normalizado)
    const duplicateNamedGroups = [
      { id: "11111111-1111-4111-8111-111111111111", nome: "Despensa" },
      { id: "33333333-3333-4333-8333-333333333333", nome: "despensa" },
    ];
    const nameAmbiguous = resolveGroupId(duplicateNamedGroups, "despensa");
    expect(nameAmbiguous.groupId).toBeUndefined();
    expect(nameAmbiguous.error).toContain("Nome de grupo ambíguo ('despensa')");
    expect(nameAmbiguous.error).toContain("11111111-1111-4111-8111-111111111111");
    expect(nameAmbiguous.error).toContain("33333333-3333-4333-8333-333333333333");

    // Grupo inexistente
    const denied = resolveGroupId(groups, "Escritório");
    expect(denied.error).toContain("Acesso negado ao grupo especificado.");
    expect(denied.error).toContain("Casa Principal");
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

const setupStockTools = () => {
  const tools: Record<
    string,
    (
      args: Record<string, unknown>,
      extra: unknown,
    ) => Promise<{ content: { type: string; text: string }[] }>
  > = {};
  const mockServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
      tools[name] = handler as (
        args: Record<string, unknown>,
        extra: unknown,
      ) => Promise<{ content: { type: string; text: string }[] }>;
    }),
  };
  registerStockTools(mockServer as unknown);
  return { tools, mockServer };
};

describe("MCP Tools (Stock)", () => {
  it("registers all stock tools correctly", () => {
    const { tools, mockServer } = setupStockTools();
    expect(mockServer.registerTool).toHaveBeenCalled();
    expect(Object.keys(tools)).toEqual(
      expect.arrayContaining([
        "get_stock_items",
        "consume_stock_item",
        "get_expiring_items",
        "get_low_stock_items",
        "update_stock_item_validity",
        "add_stock_item",
        "set_stock_quantity",
        "update_stock_item",
        "delete_stock_item",
        "find_duplicate_stock_items",
        "merge_stock_items",
      ]),
    );
  });

  it("executes get_stock_items successfully when query succeeds", async () => {
    const { tools } = setupStockTools();

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
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_stock_items"]({ group_id: "casa", filtro: "todos" }, extra);
    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Arroz");
  });

  it("lists clear group names in get_stock_items when user has multiple groups and omits group_id", async () => {
    const { tools } = setupStockTools();

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [
          { id: "g1", nome: "Apartamento" },
          { id: "g2", nome: "Sítio" },
        ],
        scopes: ["read"],
        supabase: {},
      },
    };

    const result = await tools["get_stock_items"]({ filtro: "todos" }, extra);
    expect(result.content[0].text).toContain("Múltiplos grupos encontrados");
    expect(result.content[0].text).toContain("Apartamento (g1)");
    expect(result.content[0].text).toContain("Sítio (g2)");
  });

  it("supports filtro 'vencido' in get_stock_items", async () => {
    const { tools } = setupStockTools();
    const ltMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-expired",
          nome: "Iogurte",
          quantidade: 2,
          data_validade_alerta: "2020-01-01",
          validade_nao_aplica: false,
        },
      ],
      error: null,
    });
    const eqMock = vi.fn().mockReturnThis();
    const gtMock = vi.fn().mockReturnThis();

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        gt: gtMock,
        eq: eqMock,
        lt: ltMock,
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_stock_items"]({ filtro: "vencido" }, extra);
    expect(gtMock).toHaveBeenCalledWith("quantidade", 0);
    expect(eqMock).toHaveBeenCalledWith("group_id", "g1");
    expect(eqMock).toHaveBeenCalledWith("validade_nao_aplica", false);
    expect(ltMock).toHaveBeenCalledWith(
      "data_validade_alerta",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(result.content[0].text).toContain("Iogurte");
  });

  it("supports apenas_vencidos: true in get_expiring_items", async () => {
    const { tools } = setupStockTools();
    const orderMock = vi.fn().mockResolvedValue({
      data: [{ id: "item-exp", nome: "Queijo", quantidade: 1, data_validade_alerta: "2022-05-10" }],
      error: null,
    });
    const ltMock = vi.fn(() => ({ order: orderMock }));
    const gtMock = vi.fn().mockReturnThis();

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gt: gtMock,
        lt: ltMock,
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_expiring_items"]({ apenas_vencidos: true }, extra);
    expect(gtMock).toHaveBeenCalledWith("quantidade", 0);
    expect(ltMock).toHaveBeenCalledWith(
      "data_validade_alerta",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
    expect(result.content[0].text).toContain("Queijo");
  });

  it("throws database error in get_stock_items when query fails", async () => {
    const { tools } = setupStockTools();

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
      tools["get_stock_items"]({ group_id: "g1", filtro: "todos" }, extra),
    ).rejects.toThrow("Falha ao carregar itens do estoque: connection timeout");
  });

  it("executes consume_stock_item successfully calling consume_stock_fifo with correct parameters", async () => {
    const { tools } = setupStockTools();

    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "99240b13-7904-4f19-9784-60db8893834c",
              group_id: "g1",
              nome: "Item Teste",
              quantidade: 5,
              unidade: "Un",
            },
          ],
          error: null,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    };

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
      p_observacao: "Consumo rápido",
      p_origem: "quick_consume",
      p_criado_por: "u-test-123",
    });
  });

  it("executes consume_stock_item with tipo 'descarte' and motivo for expired food without inflating consumption", async () => {
    const { tools } = setupStockTools();
    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "99240b13-7904-4f19-9784-60db8893834c",
              group_id: "g1",
              nome: "Item Teste",
              quantidade: 5,
              unidade: "Un",
            },
          ],
          error: null,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u-test-123",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["consume_stock_item"](
      {
        item_id: "99240b13-7904-4f19-9784-60db8893834c",
        quantidade: 2,
        tipo: "descarte",
        motivo: "Venceu semana passada",
      },
      extra,
    );

    expect(result).toBeDefined();
    expect(result.content[0].text).toContain("Descarte registrado com sucesso.");
    expect(rpcMock).toHaveBeenCalledWith("consume_stock_fifo", {
      p_stock_item_id: "99240b13-7904-4f19-9784-60db8893834c",
      p_quantidade: 2,
      p_tipo: "descarte",
      p_observacao: "Venceu semana passada",
      p_origem: "quick_consume",
      p_criado_por: "u-test-123",
    });
  });

  it("throws generic error when consume_stock_fifo fails in consume_stock_item", async () => {
    const { tools } = setupStockTools();

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "item não encontrado" },
    });
    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              id: "99240b13-7904-4f19-9784-60db8893834c",
              group_id: "g1",
              nome: "Item Teste",
              quantidade: 5,
              unidade: "Un",
            },
          ],
          error: null,
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    };

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
    const { tools } = setupStockTools();

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
    const { tools } = setupStockTools();

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
    const { tools } = setupStockTools();

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
    const { tools } = setupStockTools();

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

  it("creates a new stock item via add_stock_item with friendly group name and normalized unit", async () => {
    const { tools } = setupStockTools();

    const maybeSingleMock = vi.fn().mockResolvedValue({
      data: {
        id: "new-item-uuid",
        group_id: "g-casa",
        nome: "Feijão Carioca",
        categoria: "Graos",
        unidade: "Kg",
        quantidade: 3,
        quantidade_minima: 1,
        data_validade_alerta: "2027-06-01",
        validade_nao_aplica: false,
        auto_adicionar_lista: true,
      },
      error: null,
    });
    const selectMock = vi.fn(() => ({ maybeSingle: maybeSingleMock }));
    const stockItemsInsertMock = vi.fn(() => ({ select: selectMock }));
    const movementsInsertMock = vi.fn().mockResolvedValue({ error: null });

    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return { insert: stockItemsInsertMock };
        }
        if (table === "stock_movements") {
          return { insert: movementsInsertMock };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [
          { id: "g-casa", nome: "Minha Casa" },
          { id: "g-praia", nome: "Casa de Praia" },
        ],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["add_stock_item"](
      {
        group_id: "minha casa",
        nome: "Feijão Carioca",
        categoria: "Graos",
        quantidade: 3,
        quantidade_minima: 1,
        unidade: "kg",
        origem: "estoque_inicial",
        data_validade: "2027-06-01",
        nao_aplica: false,
        auto_adicionar_lista: true,
      },
      extra,
    );

    expect(stockItemsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: "g-casa",
        nome: "Feijão Carioca",
        categoria: "Graos",
        unidade: "Kg",
        quantidade: 3,
        quantidade_atual: 3,
        quantidade_minima: 1,
        data_validade: "2027-06-01",
        data_validade_alerta: "2027-06-01",
        validade_nao_aplica: false,
        auto_adicionar_lista: true,
      }),
    );
    expect(movementsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: "new-item-uuid",
        stock_item_id: "new-item-uuid",
        tipo: "estoque_inicial",
        quantidade: 3,
        unidade: "Kg",
        origem: "initial_stock",
      }),
    );
    expect(result.content[0].text).toContain("Feijão Carioca");
  });

  it("adjusts inventory balance via set_stock_quantity and records audit movement with tipo = 'ajuste'", async () => {
    const { tools } = setupStockTools();

    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));
    const movementInsertMock = vi.fn().mockResolvedValue({ error: null });

    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: itemId,
                    group_id: "g1",
                    nome: "Café Torrado",
                    quantidade: 2,
                    unidade: "pct",
                  },
                  error: null,
                }),
              })),
            })),
            update: updateMock,
          };
        }
        if (table === "stock_movements") {
          return {
            insert: movementInsertMock,
          };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u-auditor",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["set_stock_quantity"](
      {
        item_id: itemId,
        quantidade: 5,
        observacao: "Contagem física na despensa",
      },
      extra,
    );

    expect(updateMock).toHaveBeenCalledWith({
      quantidade: 5,
      quantidade_atual: 5,
    });
    expect(updateEqMock).toHaveBeenCalledWith("id", itemId);
    expect(movementInsertMock).toHaveBeenCalledWith({
      item_id: itemId,
      stock_item_id: itemId,
      tipo: "ajuste",
      quantidade: 5,
      unidade: "pct",
      observacao: "[Correção Auditada] Contagem física na despensa (2 -> 5)",
      origem: "adjustment",
      criado_por: "u-auditor",
    });
    expect(result.content[0].text).toContain("Café Torrado");
    expect(result.content[0].text).toContain("2 -> 5 pct");
  });

  it("updates stock item metadata via update_stock_item and rejects empty field updates", async () => {
    const { tools } = setupStockTools();

    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const updateEqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn(() => ({ eq: updateEqMock }));

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: itemId, group_id: "g1", nome: "Leite" },
              error: null,
            }),
          })),
        })),
        update: updateMock,
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    await expect(tools["update_stock_item"]({ item_id: itemId }, extra)).rejects.toThrow(
      "Informe ao menos um campo para atualizar",
    );

    const result = await tools["update_stock_item"](
      {
        item_id: itemId,
        nome: "Leite Integral UHT",
        categoria: "Laticinios",
        unidade: "l",
        quantidade_minima: 4,
        auto_adicionar_lista: true,
      },
      extra,
    );

    expect(updateMock).toHaveBeenCalledWith({
      nome: "Leite Integral UHT",
      categoria: "Laticinios",
      unidade: "L",
      quantidade_minima: 4,
      auto_adicionar_lista: true,
    });
    expect(result.content[0].text).toContain("Leite Integral UHT");
  });

  it("deletes stock item via delete_stock_item and blocks cross-group deletion", async () => {
    const { tools } = setupStockTools();

    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const deleteEqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn(() => ({ eq: deleteEqMock }));

    let itemGroupId = "g1";
    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockImplementation(async () => ({
              data: { id: itemId, group_id: itemGroupId, nome: "Biscoito" },
              error: null,
            })),
          })),
        })),
        delete: deleteMock,
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["delete_stock_item"]({ item_id: itemId }, extra);
    expect(deleteEqMock).toHaveBeenCalledWith("id", itemId);
    expect(result.content[0].text).toContain("Biscoito");

    // Tentativa de excluir item de outro grupo
    itemGroupId = "g-other";
    await expect(tools["delete_stock_item"]({ item_id: itemId }, extra)).rejects.toThrow(
      "Acesso negado ao grupo especificado.",
    );
  });

  it("detects duplicate items via find_duplicate_stock_items using normalization and similarity", async () => {
    const { tools } = setupStockTools();

    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [
            { id: "id-1", nome: "Leite Integral", quantidade: 4, unidade: "L" },
            { id: "id-2", nome: "leite int", quantidade: 2, unidade: "L" },
            { id: "id-3", nome: "Sabão em Pó", quantidade: 1, unidade: "Kg" },
          ],
          error: null,
        }),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["find_duplicate_stock_items"]({}, extra);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total_grupos_duplicados).toBe(1);
    expect(parsed.duplicados[0].sugestao_item_principal_id).toBe("id-1");
    expect(parsed.duplicados[0].quantidade_total).toBe(6);
    expect(parsed.duplicados[0].itens).toHaveLength(2);
  });

  it("merges duplicate items into target via merge_stock_items transferring lots, movements, and balance", async () => {
    const { tools } = setupStockTools();

    const targetId = "11111111-1111-4111-8111-111111111111";
    const dupId = "22222222-2222-4222-8222-222222222222";

    const lotsInMock = vi.fn().mockResolvedValue({ error: null });
    const movementsInMock = vi.fn().mockResolvedValue({ error: null });
    const movementsInsertMock = vi.fn().mockResolvedValue({ error: null });
    const stockDeleteInMock = vi.fn().mockResolvedValue({ error: null });
    const stockUpdateEqMock = vi.fn().mockResolvedValue({ error: null });
    const stockUpdateMock = vi.fn(() => ({ eq: stockUpdateEqMock }));

    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: targetId,
                    group_id: "g1",
                    nome: "Arroz Branco",
                    quantidade: 5,
                    quantidade_minima: 2,
                    unidade: "Kg",
                    data_validade_alerta: "2027-08-01",
                    validade_nao_aplica: false,
                    auto_adicionar_lista: false,
                  },
                  {
                    id: dupId,
                    group_id: "g1",
                    nome: "arroz branco",
                    quantidade: 3,
                    quantidade_minima: 4,
                    unidade: "Kg",
                    data_validade_alerta: "2027-05-01",
                    validade_nao_aplica: false,
                    auto_adicionar_lista: true,
                  },
                ],
                error: null,
              }),
            })),
            delete: vi.fn(() => ({ in: stockDeleteInMock })),
            update: stockUpdateMock,
          };
        }
        if (table === "stock_lots") {
          return {
            update: vi.fn(() => ({ in: lotsInMock })),
          };
        }
        if (table === "stock_movements") {
          return {
            update: vi.fn(() => ({ in: movementsInMock })),
            insert: movementsInsertMock,
          };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u-merge",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["merge_stock_items"](
      {
        target_item_id: targetId,
        source_item_ids: [dupId],
      },
      extra,
    );

    expect(lotsInMock).toHaveBeenCalledWith("stock_item_id", [dupId]);
    expect(movementsInMock).toHaveBeenCalledWith("stock_item_id", [dupId]);
    expect(stockDeleteInMock).toHaveBeenCalledWith("id", [dupId]);
    expect(stockUpdateMock).toHaveBeenCalledWith({
      quantidade: 8,
      quantidade_atual: 8,
      quantidade_minima: 4,
      auto_adicionar_lista: true,
      data_validade: "2027-05-01",
      data_validade_alerta: "2027-05-01",
    });
    expect(movementsInsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        item_id: targetId,
        stock_item_id: targetId,
        tipo: "ajuste",
        quantidade: 8,
        origem: "merge",
        criado_por: "u-merge",
      }),
    );
    expect(result.content[0].text).toContain("Mesclagem concluída com sucesso");
    expect(result.content[0].text).toContain("8 Kg");
  });
});

const setupInsightTools = () => {
  const tools: Record<
    string,
    (
      args: Record<string, unknown>,
      extra: unknown,
    ) => Promise<{ content: { type: string; text: string }[] }>
  > = {};
  const mockServer = {
    registerTool: vi.fn((name: string, _config: unknown, handler: unknown) => {
      tools[name] = handler as (
        args: Record<string, unknown>,
        extra: unknown,
      ) => Promise<{ content: { type: string; text: string }[] }>;
    }),
  };
  registerInsightTools(mockServer as unknown);
  return { tools, mockServer };
};

describe("MCP Issue #68 Improvements", () => {
  it("get_stock_items returns data_compra and data_validade and supports filtro 'em_estoque'", async () => {
    const { tools } = setupStockTools();
    const gtMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-1",
          nome: "Café",
          categoria: "Bebidas",
          quantidade: 2,
          quantidade_minima: 1,
          unidade: "pct",
          data_compra: "2026-11-01",
          data_validade: "2027-05-01",
          data_validade_alerta: "2027-05-01",
          auto_adicionar_lista: false,
          validade_nao_aplica: false,
        },
      ],
      error: null,
    });
    const eqMock = vi.fn(() => ({ gt: gtMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fakeSupabase = {
      from: vi.fn(() => ({ select: selectMock })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_stock_items"]({ filtro: "em_estoque" }, extra);
    expect(selectMock).toHaveBeenCalledWith(
      expect.stringContaining("data_compra, data_validade, data_validade_alerta"),
    );
    expect(eqMock).toHaveBeenCalledWith("group_id", "g1");
    expect(gtMock).toHaveBeenCalledWith("quantidade", 0);
    expect(result.content[0].text).toContain("Café");
    expect(result.content[0].text).toContain("2026-11-01");
  });

  it("get_stock_items supports filtro 'sem_validade' ignoring items without stock", async () => {
    const { tools } = setupStockTools();
    const isMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "item-no-val",
          nome: "Biscoito",
          quantidade: 3,
          data_validade_alerta: null,
          validade_nao_aplica: false,
        },
      ],
      error: null,
    });
    const eqValidadeMock = vi.fn(() => ({ is: isMock }));
    const gtMock = vi.fn(() => ({ eq: eqValidadeMock }));
    const eqGroupMock = vi.fn(() => ({ gt: gtMock }));
    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({ eq: eqGroupMock })),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_stock_items"]({ filtro: "sem_validade" }, extra);
    expect(eqGroupMock).toHaveBeenCalledWith("group_id", "g1");
    expect(gtMock).toHaveBeenCalledWith("quantidade", 0);
    expect(eqValidadeMock).toHaveBeenCalledWith("validade_nao_aplica", false);
    expect(isMock).toHaveBeenCalledWith("data_validade_alerta", null);
    expect(result.content[0].text).toContain("Biscoito");
  });

  it("get_purchase_history returns purchase lots and filters by product and days", async () => {
    const { tools } = setupInsightTools();
    const limitMock = vi.fn().mockResolvedValue({
      data: [
        {
          id: "lot-1",
          data_compra: "2026-10-15",
          quantidade_inicial: 10,
          quantidade_restante: 6,
          unidade: "Kg",
          custo_unitario: 5.5,
          custo_total: 55,
          data_validade: "2027-01-01",
          stock_items: { id: "item-arroz", nome: "Arroz Tio João", categoria: "Grãos", group_id: "g1" },
        },
      ],
      error: null,
    });
    const orderMock = vi.fn(() => ({ limit: limitMock }));
    const ilikeMock = vi.fn(() => ({ order: orderMock }));
    const gteMock = vi.fn(() => ({ order: orderMock, ilike: ilikeMock }));
    const eqMock = vi.fn(() => ({ gte: gteMock }));
    const fakeSupabase = {
      from: vi.fn((table: string) => {
        expect(table).toBe("stock_lots");
        return {
          select: vi.fn(() => ({ eq: eqMock })),
        };
      }),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["get_purchase_history"](
      { produto: "Arroz", dias: 60 },
      extra,
    );

    expect(eqMock).toHaveBeenCalledWith("stock_items.group_id", "g1");
    expect(gteMock).toHaveBeenCalledWith("data_compra", expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(ilikeMock).toHaveBeenCalledWith("stock_items.nome", "%Arroz%");
    expect(orderMock).toHaveBeenCalledWith("data_compra", { ascending: false });

    const parsed = JSON.parse(result.content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({
      nome: "Arroz Tio João",
      data_compra: "2026-10-15",
      quantidade_inicial: 10,
      quantidade_restante: 6,
      unidade: "Kg",
      custo_unitario: 5.5,
      custo_total: 55,
      data_validade: "2027-01-01",
    });
  });

  it("update_stock_item_validity calculates relative date from data_compra and persists Catalog Learning", async () => {
    const { tools } = setupStockTools();
    const itemId = "a1111111-1111-4111-8111-111111111111";
    const catalogId = "c1111111-1111-4111-8111-111111111111";

    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const catalogUpdateMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: itemId,
                    group_id: "g1",
                    nome: "Pão de Forma",
                    product_id: catalogId,
                    data_compra: "2026-11-01",
                  },
                ],
                error: null,
              }),
            })),
          };
        }
        if (table === "product_catalog") {
          return {
            update: catalogUpdateMock,
          };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["update_stock_item_validity"](
      {
        item_id: itemId,
        prazo_dias: 14,
        base_calculo: "data_compra",
      },
      extra,
    );

    // 2026-11-01 + 14 dias = 2026-11-15
    expect(rpcMock).toHaveBeenCalledWith("rpc_bulk_update_stock_validity", {
      p_item_ids: [itemId],
      p_data_validade: "2026-11-15",
      p_nao_aplica: false,
    });
    expect(catalogUpdateMock).toHaveBeenCalledWith({
      validade_padrao_dias: 14,
      perecivel: true,
    });
    expect(result.content[0].text).toContain("2026-11-15");
    expect(result.content[0].text).toContain("catálogo aprendido: validade padrão de 14 dias");
  });

  it("update_stock_item_validity falls back to 'hoje' when data_compra is missing", async () => {
    const { tools } = setupStockTools();
    const itemId = "b2222222-2222-4222-8222-222222222222";
    const rpcMock = vi.fn().mockResolvedValue({ data: null, error: null });

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: itemId,
                    group_id: "g1",
                    nome: "Fruta",
                    product_id: null,
                    data_compra: null,
                  },
                ],
                error: null,
              }),
            })),
          };
        }
        if (table === "stock_lots") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        if (table === "product_catalog") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                ilike: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
                })),
              })),
            })),
          };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["update_stock_item_validity"](
      {
        item_id: itemId,
        prazo_dias: 7,
        base_calculo: "data_compra",
      },
      extra,
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "rpc_bulk_update_stock_validity",
      expect.objectContaining({
        p_item_ids: [itemId],
        p_nao_aplica: false,
      }),
    );
    expect(result.content[0].text).toContain("fallback para 'hoje'");
  });

  it("consume_stock_item supports consumir_tudo: true and clears residual expiration date when zeroed", async () => {
    const { tools } = setupStockTools();
    const itemId = "c3333333-3333-4333-8333-333333333333";
    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });
    const stockUpdateMock = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: itemId,
                    group_id: "g1",
                    nome: "Pão Australiano",
                    quantidade: 0.382,
                    unidade: "Kg",
                    data_validade: "2026-11-20",
                    data_validade_alerta: "2026-11-20",
                  },
                ],
                error: null,
              }),
            })),
            update: stockUpdateMock,
          };
        }
        return {};
      }),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["consume_stock_item"](
      {
        item_id: itemId,
        consumir_tudo: true,
      },
      extra,
    );

    expect(rpcMock).toHaveBeenCalledWith("consume_stock_fifo", {
      p_stock_item_id: itemId,
      p_quantidade: 0.382,
      p_tipo: "saida",
      p_observacao: "Consumo rápido",
      p_origem: "quick_consume",
      p_criado_por: "u1",
    });

    expect(stockUpdateMock).toHaveBeenCalledWith({
      data_validade: null,
      data_validade_alerta: null,
    });

    expect(result.content[0].text).toContain("Pão Australiano: 0.382 Kg baixado(s)");
    expect(result.content[0].text).toContain("saldo zerado, alerta de validade limpo");
  });

  it("consume_stock_item supports batch consumption via item_ids and itens array", async () => {
    const { tools } = setupStockTools();
    const id1 = "d4444444-4444-4444-8444-444444444441";
    const id2 = "d4444444-4444-4444-8444-444444444442";
    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: id1, group_id: "g1", nome: "Maçã", quantidade: 5, unidade: "un" },
              { id: id2, group_id: "g1", nome: "Banana", quantidade: 6, unidade: "un" },
            ],
            error: null,
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read", "write"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["consume_stock_item"](
      {
        itens: [
          { item_id: id1, quantidade: 2 },
          { item_id: id2, consumir_tudo: true },
        ],
      },
      extra,
    );

    expect(rpcMock).toHaveBeenCalledWith(
      "consume_stock_fifo",
      expect.objectContaining({ p_stock_item_id: id1, p_quantidade: 2 }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "consume_stock_fifo",
      expect.objectContaining({ p_stock_item_id: id2, p_quantidade: 6 }),
    );
    expect(result.content[0].text).toContain("2 itens em lote");
  });

  it("find_duplicate_stock_items penalizes divergent package specs and highlights possui_item_zerado", async () => {
    // 1. Validar que embalagens divergentes não são agrupadas
    const simOvos = computeStockNameSimilarity("Ovos 20 unidades", "Ovos 5 duzias");
    expect(simOvos).toBeLessThan(0.75);

    const simLeite = computeStockNameSimilarity("Leite Condensado 397g", "Leite Condensado 1kg");
    expect(simLeite).toBeLessThan(0.75);

    // 2. Validar sinalização de possui_item_zerado: true no cluster
    const { tools } = setupStockTools();
    const fakeSupabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "item-active",
                nome: "Molho de Tomate Tradicional",
                quantidade: 2,
                unidade: "un",
              },
              {
                id: "item-zero",
                nome: "Molho de Tomate Tradicional",
                quantidade: 0,
                unidade: "un",
              },
            ],
            error: null,
          }),
        })),
      })),
    };

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1", nome: "Casa" }],
        scopes: ["read"],
        supabase: fakeSupabase,
      },
    };

    const result = await tools["find_duplicate_stock_items"]({}, extra);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.total_grupos_duplicados).toBe(1);
    expect(parsed.duplicados[0].possui_item_zerado).toBe(true);
    expect(parsed.duplicados[0].sugestao_item_principal_id).toBe("item-active");
  });

  it("consume_stock_item rejects item_ids without explicit quantidade or consumir_tudo: true", async () => {
    const { tools } = setupStockTools();
    const itemId = "99240b13-7904-4f19-9784-60db8893834c";

    const extra = {
      authInfo: {
        userId: "u1",
        groups: [{ id: "g1" }],
        scopes: ["read", "write"],
        supabase: {
          rpc: vi.fn(),
          from: vi.fn(),
        },
      },
    };

    await expect(
      tools["consume_stock_item"](
        {
          item_ids: [itemId],
        },
        extra,
      ),
    ).rejects.toThrow("Informe uma quantidade positiva ou utilize 'consumir_tudo: true' para dar baixa.");
  });

  it("consume_stock_item consolidates duplicate item IDs summing positive quantities", async () => {
    const { tools } = setupStockTools();
    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{ id: itemId, group_id: "g1", nome: "Iogurte", quantidade: 10, unidade: "un" }],
            error: null,
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
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

    const result = await tools["consume_stock_item"](
      {
        itens: [
          { item_id: itemId, quantidade: 2 },
          { item_id: itemId, quantidade: 3 },
        ],
      },
      extra,
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith(
      "consume_stock_fifo",
      expect.objectContaining({ p_stock_item_id: itemId, p_quantidade: 5 }),
    );
    expect(result.content[0].text).toContain("5 un baixado(s)");
  });

  it("consume_stock_item throws error when clearing validity alert on zeroed item fails", async () => {
    const { tools } = setupStockTools();
    const itemId = "99240b13-7904-4f19-9784-60db8893834c";
    const rpcMock = vi.fn().mockResolvedValue({ data: 1, error: null });

    const fakeSupabase = {
      rpc: rpcMock,
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          in: vi.fn().mockResolvedValue({
            data: [{ id: itemId, group_id: "g1", nome: "Queijo", quantidade: 1, unidade: "un" }],
            error: null,
          }),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { code: "P0001", message: "falha ao atualizar item" },
          }),
        })),
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
      tools["consume_stock_item"](
        {
          item_id: itemId,
          consumir_tudo: true,
        },
        extra,
      ),
    ).rejects.toThrow("Falha ao limpar alertas de validade do item zerado: falha ao atualizar item");
  });

  it("add_stock_item throws error when stock_movements insert fails", async () => {
    const { tools } = setupStockTools();
    const fakeSupabase = {
      from: vi.fn((table: string) => {
        if (table === "stock_items") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { id: "new-item-123", group_id: "g1", nome: "Arroz" },
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "stock_movements") {
          return {
            insert: vi.fn().mockResolvedValue({
              error: { code: "P0002", message: "falha ao auditar movimentacao" },
            }),
          };
        }
        return {};
      }),
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
      tools["add_stock_item"](
        {
          nome: "Arroz",
          quantidade: 2,
        },
        extra,
      ),
    ).rejects.toThrow("Falha ao registrar movimentação no histórico de estoque: falha ao auditar movimentacao");
  });
});
