import { z } from "zod";
import type { AuthenticatedContext } from "../auth";

export const registerListTools = (server: unknown) => {
  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "get_shopping_list",
    {
      title: "Get Shopping List",
      description: "Retorna todos os itens da lista de compras ativa do grupo",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),}),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
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

      const { data: activeList } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("group_id", groupId)
        .eq("ativa", true)
        .limit(1)
        .maybeSingle();

      if (!activeList) {
        return { content: [{ type: "text", text: "Nenhuma lista ativa encontrada." }] };
      }

      const { data: items } = await supabase
        .from("items")
        .select("id, nome, quantidade, categoria, comprado, preco")
        .eq("list_id", activeList.id)
        .order("criado_em", { ascending: true });

      return {
        content: [{ type: "text", text: JSON.stringify(items || [], null, 2) }],
      };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "add_item_to_list",
    {
      title: "Add Item to List",
      description: "Adiciona um item na lista de compras ativa",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      nome: z.string().min(1),
      quantidade: z.string().default("1"),
      categoria: z.string().default("Outros"),
      preco: z.number().optional(),
    }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase, userId } = context;
      const groups = (context as { groups: { id: string }[] }).groups;
      let groupId = (args as { group_id?: string }).group_id;
      if (!groupId) {
        if (groups.length === 1) groupId = groups[0].id;
        else if (groups.length === 0) return { content: [{ type: "text", text: "Usuário não possui grupo ativo." }] };
        else return { content: [{ type: "text", text: "Múltiplos grupos encontrados. Especifique 'group_id' nos argumentos. Grupos: " + JSON.stringify(groups) }] };
      } else if (!groups.find(g => g.id === groupId)) {
        return { content: [{ type: "text", text: "Acesso negado ao grupo especificado." }] };
      }

      const { data: activeList } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("group_id", groupId)
        .eq("ativa", true)
        .limit(1)
        .maybeSingle();

      if (!activeList) throw new Error("Lista ativa não encontrada");

      // TODO: Refatorar para usar a procedure "add_item_to_list" em vez de inserção direta com valores default otimistas.
      const { error } = await supabase.from("items").insert({
        list_id: activeList.id,
        nome: (args as { nome: string }).nome,
        quantidade: (args as { quantidade: string | number }).quantidade,
        categoria: (args as { categoria: string }).categoria,
        preco: (args as { preco?: number }).preco ?? null,
        comprado: false,
        criado_por: userId,
      });

      if (error) throw new Error(`Erro ao inserir: ${error.message}`);
      return { content: [{ type: "text", text: `Item ${(args as { nome: string }).nome} adicionado com sucesso.` }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "remove_item_from_list",
    {
      title: "Remove Item from List",
      description: "Remove um item da lista de compras pelo ID",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"), item_id: z.string().uuid() }),
    async (args: { item_id: string }, context: AuthenticatedContext) => {
      const { supabase } = context;
      const { error } = await supabase.from("items").delete().eq("id", (args as { item_id: string }).item_id);
      if (error) throw new Error(`Erro ao remover: ${error.message}`);
      return { content: [{ type: "text", text: "Item removido com sucesso." }] };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "mark_item_as_bought",
    {
      title: "Mark Item as Bought",
      description: "Marca ou desmarca um item como comprado e opcionalmente registra o preco",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      item_id: z.string().uuid(),
      comprado: z.boolean().default(true),
      preco: z.number().optional(),
    }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase } = context;
      const updateData: Record<string, unknown> = { comprado: (args as { comprado: boolean }).comprado };
      if ((args as { preco?: number }).preco !== undefined) {
        (updateData as Record<string, unknown>).preco = (args as { preco?: number }).preco;
        (updateData as Record<string, unknown>).preco_total = (args as { preco?: number }).preco;
      }

      const { error } = await supabase.from("items").update(updateData as never).eq("id", (args as { item_id: string }).item_id);
      if (error) throw new Error(`Erro ao marcar item: ${error.message}`);
      return {
        content: [
          { type: "text", text: `Item marcado como ${(args as { comprado: boolean }).comprado ? "comprado" : "pendente"}.` },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, desc: unknown, schema: unknown, handler: unknown) => void }).registerTool(
    "finalize_shopping_list",
    {
      title: "Finalize Shopping List",
      description: "Finaliza a lista ativa e move itens comprados para o estoque",
    },
    z.object({ group_id: z.string().optional().describe("ID do grupo. Opcional caso o usuário só tenha 1 grupo"),
      list_id: z.string().uuid(),
      data_compra: z.string().optional(),
    }),
    async (args: Record<string, unknown>, context: AuthenticatedContext) => {
      const { supabase } = context;
      const { data, error } = await supabase.rpc("rpc_finalize_shopping_list", {
        p_list_id: (args as { list_id: string }).list_id,
        p_purchase_date: (args as { data_compra?: string }).data_compra ?? new Date().toISOString().slice(0, 10),
      });

      if (error) throw new Error(`Erro ao finalizar lista: ${error.message}`);
      return { content: [{ type: "text", text: JSON.stringify(data || {}, null, 2) }] };
    },
  );
};
