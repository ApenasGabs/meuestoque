import { z } from "zod";
import type { AuthenticatedContext } from "../auth";

const extractContext = (extra: unknown): AuthenticatedContext => {
  const e = extra as Record<string, unknown> | undefined;
  const http = e?.http as Record<string, unknown> | undefined;
  const ctx = (http?.authInfo ?? e?.authInfo ?? e?.auth ?? e?.context) as AuthenticatedContext | undefined;
  if (!ctx) {
    const keys = e ? Object.keys(e).join(",") : "null";
    const httpKeys = http ? Object.keys(http).join(",") : "none";
    throw new Error(`Contexto de autenticação não encontrado. Extra: [${keys}], Http: [${httpKeys}]`);
  }
  return ctx;
};


export const registerStockTools = (server: unknown) => {
  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_stock_items",
    {
      title: "Get Stock Items",
      description: "Lista itens do estoque baseados num filtro (todos, baixo, vencendo, zerado)",
      inputSchema: z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
        filtro: z.enum(["todos", "baixo", "vencendo", "zerado"]).default("todos"),
        dias_vencimento: z.number().int().default(7),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const groups = (context as { groups: { id: string }[] }).groups;
      let groupId = (args as { group_id?: string }).group_id;
      if (!groupId) {
        if (groups.length === 1) groupId = groups[0].id;
        else if (groups.length === 0) return { content: [{ type: "text", text: "Usuário não possui grupo ativo." }] };
        else return { content: [{ type: "text", text: "Múltiplos grupos encontrados. Especifique 'group_id' nos argumentos. Grupos: " + JSON.stringify(groups) }] };
      } else if (!groups.find(g => g.id === groupId)) {
        return { content: [{ type: "text", text: "Acesso negado ao grupo especificado." }] };
      }

      let query = supabase
        .from("stock_items")
        .select(
          "id, nome, categoria, quantidade, quantidade_minima, unidade, data_validade_alerta, auto_adicionar_lista, validade_nao_aplica",
        )
        .eq("group_id", groupId);

      if ((args as { filtro: string }).filtro === "baixo") {
        // O filtro "baixo" real deve ser feito em memória, pois lte não compara duas colunas via PostgREST de forma simples sem RPC.
      } else if ((args as { filtro: string }).filtro === "zerado") {
        query = query.lte("quantidade", 0);
      } else if ((args as { filtro: string }).filtro === "vencendo") {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + (args as { dias_vencimento: number }).dias_vencimento);
        query = query
          .eq("validade_nao_aplica", false)
          .lte("data_validade_alerta", threshold.toISOString().slice(0, 10));
      }

      const { data, error } = await query;
      if (error) console.error(error); throw new Error("Erro interno de banco de dados");

      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "consume_stock_item",
    {
      title: "Consume Stock Item",
      description: "Registra o consumo de um item do estoque",
      inputSchema: z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      item_id: z.string().uuid(),
      quantidade: z.number().positive(),
    }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase, userId } = context;

      const { error } = await supabase.rpc("consume_stock_fifo", {
        p_item_id: (args as { item_id: string }).item_id,
        p_quantidade: (args as { quantidade: string | number }).quantidade,
        p_user_id: userId,
      });

      if (error) console.error(error); throw new Error("Erro interno ao consumir estoque");
      return { content: [{ type: "text", text: `Consumo registrado com sucesso.` }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_expiring_items",
    {
      title: "Get Expiring Items",
      description: "Lista itens que vencem nos próximos N dias",
      inputSchema: z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"), dias: z.number().int().min(1).max(90).default(7) }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const groups = (context as { groups: { id: string }[] }).groups;
      let groupId = (args as { group_id?: string }).group_id;
      if (!groupId) {
        if (groups.length === 1) groupId = groups[0].id;
        else if (groups.length === 0) return { content: [{ type: "text", text: "Usuário não possui grupo ativo." }] };
        else return { content: [{ type: "text", text: "Múltiplos grupos encontrados. Especifique 'group_id' nos argumentos. Grupos: " + JSON.stringify(groups) }] };
      } else if (!groups.find(g => g.id === groupId)) {
        return { content: [{ type: "text", text: "Acesso negado ao grupo especificado." }] };
      }

      const threshold = new Date();
      threshold.setDate(threshold.getDate() + (args as { dias: number }).dias);

      const { data, error } = await supabase
        .from("stock_items")
        .select("nome, quantidade, unidade, data_validade_alerta")
        .eq("group_id", groupId)
        .eq("validade_nao_aplica", false)
        .lte("data_validade_alerta", threshold.toISOString().slice(0, 10))
        .order("data_validade_alerta", { ascending: true });

      if (error) console.error(error); throw new Error("Erro interno de banco de dados");
      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_low_stock_items",
    {
      title: "Get Low Stock Items",
      description: "Lista itens abaixo da quantidade mínima configurada",
      inputSchema: z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),}),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const groups = (context as { groups: { id: string }[] }).groups;
      let groupId = (args as { group_id?: string }).group_id;
      if (!groupId) {
        if (groups.length === 1) groupId = groups[0].id;
        else if (groups.length === 0) return { content: [{ type: "text", text: "Usuário não possui grupo ativo." }] };
        else return { content: [{ type: "text", text: "Múltiplos grupos encontrados. Especifique 'group_id' nos argumentos. Grupos: " + JSON.stringify(groups) }] };
      } else if (!groups.find(g => g.id === groupId)) {
        return { content: [{ type: "text", text: "Acesso negado ao grupo especificado." }] };
      }

      // We handle the strict logic manually since PostgREST doesn't support comparing two columns directly with operators
      const { data, error } = await supabase
        .from("stock_items")
        .select("nome, quantidade, quantidade_minima, unidade, categoria")
        .eq("group_id", groupId)
        .gt("quantidade_minima", 0);

      if (error) console.error(error); throw new Error("Erro interno de banco de dados");

      const filtered = (data || []).filter((item) => item.quantidade <= item.quantidade_minima);
      filtered.sort(
        (a, b) => b.quantidade_minima - b.quantidade - (a.quantidade_minima - a.quantidade),
      );

      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    },
  );
};
