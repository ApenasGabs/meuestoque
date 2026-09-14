import { z } from "zod";
import type { AuthenticatedContext } from "../auth";

export const registerInsightTools = (server: unknown) => {
  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_consumption_history",
    {
      title: "Get Consumption History",
      description: "Histórico de consumo de um produto (ou todos) nos últimos N dias",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      produto: z.string().optional(),
      dias: z.number().int().default(30),
    }),
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extra.authInfo;
      if (!context) throw new Error("Contexto de autenticação não encontrado");
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
      threshold.setDate(threshold.getDate() - (args as { dias: number }).dias);
      const thresholdISO = threshold.toISOString();

      let query = supabase
        .from("stock_movements")
        .select("criado_em, quantidade, tipo, stock_items!inner(nome, unidade, group_id)")
        .eq("stock_items.group_id", groupId)
        .eq("tipo", "consumo")
        .gte("criado_em", thresholdISO)
        .order("criado_em", { ascending: false })
        .limit(100);

      if ((args as { produto?: string }).produto) {
        query = query.ilike("stock_items.nome", `%${(args as { produto?: string }).produto}%`);
      }

      const { data, error } = await query;
      if (error) console.error(error); throw new Error("Erro interno de banco de dados");

      const formatted = (data || []).map((d) => ({
        data: d.criado_em,
        nome: (d.stock_items as unknown as Record<string, unknown>).nome,
        unidade: (d.stock_items as unknown as Record<string, unknown>).unidade,
        quantidade: d.quantidade,
      }));

      return { content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_spending_summary",
    {
      title: "Get Spending Summary",
      description: "Resumo de gastos em um período",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      de: z.string(),
      ate: z.string(),
    }),
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extra.authInfo;
      if (!context) throw new Error("Contexto de autenticação não encontrado");
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

      const { data, error } = await supabase
        .from("stock_lots")
        .select("custo_total, stock_items!inner(categoria, group_id)")
        .eq("stock_items.group_id", groupId)
        .gte("data_compra", (args as { de: string }).de)
        .lte("data_compra", (args as { ate: string }).ate);

      if (error) console.error(error); throw new Error("Erro interno de banco de dados");

      const summary = (data || []).reduce((acc: unknown, row: unknown) => {
        const cat = ((row as Record<string, unknown>).stock_items as Record<string, string>)?.categoria || "Outros";
        if (!(acc as Record<string, unknown>)[cat]) {
          (acc as Record<string, unknown>)[cat] = { total_gasto: 0, num_compras: 0 };
        }
        ((acc as Record<string, Record<string, number>>)[cat] as Record<string, number>).total_gasto += ((row as Record<string, number>).custo_total || 0);
        ((acc as Record<string, Record<string, number>>)[cat] as Record<string, number>).num_compras += 1;
        return acc;
      }, {});

      return { content: [{ type: "text", text: JSON.stringify(summary, null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_price_trend",
    {
      title: "Get Price Trend",
      description: "Tendência de preço de um produto nas cotações Tenda",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      produto: z.string().min(1),
      dias: z.number().int().default(30),
    }),
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extra.authInfo;
      if (!context) throw new Error("Contexto de autenticação não encontrado");
      const { supabase } = context;

      const threshold = new Date();
      threshold.setDate(threshold.getDate() - (args as { dias: number }).dias);

      const { data, error } = await supabase
        .from("store_price_history")
        .select("data_cotacao, preco, loja_nome, filial_id")
        .ilike("produto_nome", `%${(args as { produto?: string }).produto}%`)
        .gte("data_cotacao", threshold.toISOString())
        .order("data_cotacao", { ascending: false })
        .limit(30);

      if (error) console.error(error); throw new Error("Erro interno de banco de dados");
      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );
};
