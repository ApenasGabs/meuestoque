import { z } from "zod";
import type { AuthenticatedContext } from "../auth";

export const registerStockTools = (server: unknown) => {
  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_stock_items",
    {
      title: "Get Stock Items",
      description: "Lista itens do estoque baseados num filtro (todos, baixo, vencendo, zerado)",
    },
    z.object({
      filtro: z.enum(["todos", "baixo", "vencendo", "zerado"]).default("todos"),
      dias_vencimento: z.number().int().default(7),
    }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase, groupId } = context;
      if (!groupId) throw new Error("Usuário não possui grupo ativo");

      let query = supabase
        .from("stock_items")
        .select(
          "id, nome, categoria, quantidade, quantidade_minima, unidade, data_validade_alerta, auto_adicionar_lista, validade_nao_aplica",
        )
        .eq("group_id", groupId);

      if ((args as { filtro: string }).filtro === "baixo") {
        query = query.lte("quantidade", "quantidade_minima");
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
      if (error) throw new Error(error.message);

      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "consume_stock_item",
    {
      title: "Consume Stock Item",
      description: "Registra o consumo de um item do estoque",
    },
    z.object({
      item_id: z.string().uuid(),
      quantidade: z.number().positive(),
    }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase, userId } = context;

      const { error } = await supabase.rpc("consume_stock_fifo", {
        p_item_id: (args as { item_id: string }).item_id,
        p_quantidade: (args as { quantidade: string | number }).quantidade,
        p_user_id: userId,
      });

      if (error) throw new Error(`Erro ao consumir estoque: ${error.message}`);
      return { content: [{ type: "text", text: `Consumo registrado com sucesso.` }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_expiring_items",
    {
      title: "Get Expiring Items",
      description: "Lista itens que vencem nos próximos N dias",
    },
    z.object({ dias: z.number().int().min(1).max(90).default(7) }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase, groupId } = context;
      if (!groupId) throw new Error("Usuário não possui grupo ativo");

      const threshold = new Date();
      threshold.setDate(threshold.getDate() + (args as { dias: number }).dias);

      const { data, error } = await supabase
        .from("stock_items")
        .select("nome, quantidade, unidade, data_validade_alerta")
        .eq("group_id", groupId)
        .eq("validade_nao_aplica", false)
        .lte("data_validade_alerta", threshold.toISOString().slice(0, 10))
        .order("data_validade_alerta", { ascending: true });

      if (error) throw new Error(error.message);
      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_low_stock_items",
    {
      title: "Get Low Stock Items",
      description: "Lista itens abaixo da quantidade mínima configurada",
    },
    z.object({}),
    async (_args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase, groupId } = context;
      if (!groupId) throw new Error("Usuário não possui grupo ativo");

      // We handle the strict logic manually since PostgREST doesn't support comparing two columns directly with operators
      const { data, error } = await supabase
        .from("stock_items")
        .select("nome, quantidade, quantidade_minima, unidade, categoria")
        .eq("group_id", groupId)
        .gt("quantidade_minima", 0);

      if (error) throw new Error(error.message);

      const filtered = (data || []).filter((item) => item.quantidade <= item.quantidade_minima);
      filtered.sort(
        (a, b) => b.quantidade_minima - b.quantidade - (a.quantidade_minima - a.quantidade),
      );

      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    },
  );
};
