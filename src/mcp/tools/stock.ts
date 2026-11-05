import { z } from "zod";
import type { AuthenticatedContext } from "../auth";
import { extractContext, extractWriteContext } from "../context";



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
      if (error) {
        console.error(error);
        throw new Error(`Falha ao carregar itens do estoque: ${error.message || error.code || "erro no banco de dados"}`);
      }

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
      const context = extractWriteContext(extra);
      const { supabase, userId } = context;

      const { error } = await supabase.rpc("consume_stock_fifo", {
        p_stock_item_id: (args as { item_id: string }).item_id,
        p_quantidade: (args as { quantidade: number }).quantidade,
        p_tipo: "saida",
        p_origem: "quick_consume",
        p_criado_por: userId,
      });

      if (error) {
        console.error("[MCP] consume_stock_fifo:", error.code, error.message);
        const detail = error.message ? `: ${error.message}` : "";
        throw new Error(`Falha ao consumir estoque${detail}`);
      }
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

      if (error) {
        console.error(error);
        throw new Error(`Falha ao carregar itens a vencer: ${error.message || error.code || "erro no banco de dados"}`);
      }
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

      if (error) {
        console.error(error);
        throw new Error(`Falha ao carregar itens com estoque baixo: ${error.message || error.code || "erro no banco de dados"}`);
      }

      const filtered = (data || []).filter((item) => item.quantidade <= item.quantidade_minima);
      filtered.sort(
        (a, b) => b.quantidade_minima - b.quantidade - (a.quantidade_minima - a.quantidade),
      );

      return { content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "update_stock_item_validity",
    {
      title: "Update Stock Item Validity",
      description:
        "Atualiza a data de validade de um ou mais itens do estoque ou marca como 'Não se aplica' (não perecível)",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
        item_id: z
          .string()
          .uuid()
          .optional()
          .describe("ID de um único item do estoque a atualizar"),
        item_ids: z
          .array(z.string().uuid())
          .min(1)
          .optional()
          .describe("Lista de IDs de itens do estoque para atualização em lote"),
        data_validade: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD")
          .optional()
          .describe("Nova data de validade no formato YYYY-MM-DD (obrigatória quando nao_aplica for false)"),
        nao_aplica: z
          .boolean()
          .default(false)
          .describe("Se true, marca o(s) item(ns) como 'Não se aplica' (não perecível) e limpa a data de validade"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase } = context;
      const groups = (context as { groups?: { id: string }[] }).groups;
      const groupId = (args as { group_id?: string }).group_id;

      if (groupId && Array.isArray(groups) && !groups.some((g) => g.id === groupId)) {
        throw new Error("Acesso negado ao grupo especificado.");
      }

      const rawItemIds = (args as { item_ids?: string[] }).item_ids;
      const rawItemId = (args as { item_id?: string }).item_id;
      const itemIds = Array.from(
        new Set([
          ...(Array.isArray(rawItemIds) ? rawItemIds : []),
          ...(rawItemId ? [rawItemId] : []),
        ]),
      );

      if (itemIds.length === 0) {
        throw new Error("Informe ao menos um item ('item_id' ou 'item_ids') para atualizar a validade.");
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!itemIds.every((id) => uuidRegex.test(id))) {
        throw new Error("Todos os IDs de itens informados devem ser UUIDs válidos.");
      }

      const naoAplica = Boolean((args as { nao_aplica?: boolean }).nao_aplica);
      const dataValidade = (args as { data_validade?: string }).data_validade;

      if (!naoAplica) {
        if (!dataValidade) {
          throw new Error(
            "Informe 'data_validade' (YYYY-MM-DD) ou defina 'nao_aplica' como true para itens não perecíveis.",
          );
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataValidade)) {
          throw new Error("Formato inválido para 'data_validade'. Use YYYY-MM-DD.");
        }
        const parsedDate = new Date(`${dataValidade}T00:00:00.000Z`);
        if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dataValidade) {
          throw new Error("Data de validade inválida. Informe uma data real no formato YYYY-MM-DD.");
        }
      }

      const { error } = await supabase.rpc("rpc_bulk_update_stock_validity", {
        p_item_ids: itemIds,
        p_data_validade: naoAplica ? null : dataValidade,
        p_nao_aplica: naoAplica,
      });

      if (error) {
        console.error("[MCP] rpc_bulk_update_stock_validity:", error.code, error.message);
        const detail = error.message ? `: ${error.message}` : "";
        throw new Error(`Falha ao atualizar validade do estoque${detail}`);
      }

      const count = itemIds.length;
      const itemLabel = count === 1 ? "1 item atualizado" : `${count} itens atualizados`;
      const statusDetail = naoAplica
        ? "marcado(s) como 'Não se aplica' (não perecível)"
        : `validade definida para ${dataValidade}`;

      return {
        content: [
          {
            type: "text",
            text: `Validade atualizada com sucesso: ${itemLabel} (${statusDetail}).`,
          },
        ],
      };
    },
  );
};
