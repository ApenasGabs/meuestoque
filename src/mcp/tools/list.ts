import { z } from "zod";
import type { AuthenticatedContext } from "../auth";

export const registerListTools = (server: any) => {
  server.registerTool(
    "get_shopping_list",
    {
      title: "Get Shopping List",
      description: "Retorna todos os itens da lista de compras ativa do grupo",
    },
    z.object({}),
    async (_args: any, context: AuthenticatedContext) => {
      const { supabase, groupId } = context;
      if (!groupId) throw new Error("Usuário não possui grupo ativo");

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

  server.registerTool(
    "add_item_to_list",
    {
      title: "Add Item to List",
      description: "Adiciona um item na lista de compras ativa",
    },
    z.object({
      nome: z.string().min(1),
      quantidade: z.string().default("1"),
      categoria: z.string().default("Outros"),
      preco: z.number().optional(),
    }),
    async (args: any, context: AuthenticatedContext) => {
      const { supabase, groupId, userId } = context;
      if (!groupId) throw new Error("Usuário não possui grupo ativo");

      const { data: activeList } = await supabase
        .from("shopping_lists")
        .select("id")
        .eq("group_id", groupId)
        .eq("ativa", true)
        .limit(1)
        .maybeSingle();

      if (!activeList) throw new Error("Lista ativa não encontrada");

      // Simplified addition for MCP
      const { error } = await supabase.from("items").insert({
        list_id: activeList.id,
        nome: args.nome,
        quantidade: args.quantidade,
        categoria: args.categoria,
        preco: args.preco ?? null,
        comprado: false,
        criado_por: userId,
      });

      if (error) throw new Error(`Erro ao inserir: ${error.message}`);
      return { content: [{ type: "text", text: `Item ${args.nome} adicionado com sucesso.` }] };
    },
  );

  server.registerTool(
    "remove_item_from_list",
    {
      title: "Remove Item from List",
      description: "Remove um item da lista de compras pelo ID",
    },
    z.object({ item_id: z.string().uuid() }),
    async (args: { item_id: string }, context: AuthenticatedContext) => {
      const { supabase } = context;
      const { error } = await supabase.from("items").delete().eq("id", args.item_id);
      if (error) throw new Error(`Erro ao remover: ${error.message}`);
      return { content: [{ type: "text", text: "Item removido com sucesso." }] };
    },
  );

  server.registerTool(
    "mark_item_as_bought",
    {
      title: "Mark Item as Bought",
      description: "Marca ou desmarca um item como comprado e opcionalmente registra o preco",
    },
    z.object({
      item_id: z.string().uuid(),
      comprado: z.boolean().default(true),
      preco: z.number().optional(),
    }),
    async (args: any, context: AuthenticatedContext) => {
      const { supabase } = context;
      const updateData: any = { comprado: args.comprado };
      if (args.preco !== undefined) {
        updateData.preco = args.preco;
        updateData.preco_total = args.preco;
      }

      const { error } = await supabase.from("items").update(updateData).eq("id", args.item_id);
      if (error) throw new Error(`Erro ao marcar item: ${error.message}`);
      return {
        content: [
          { type: "text", text: `Item marcado como ${args.comprado ? "comprado" : "pendente"}.` },
        ],
      };
    },
  );

  server.registerTool(
    "finalize_shopping_list",
    {
      title: "Finalize Shopping List",
      description: "Finaliza a lista ativa e move itens comprados para o estoque",
    },
    z.object({
      list_id: z.string().uuid(),
      data_compra: z.string().optional(),
    }),
    async (args: any, context: AuthenticatedContext) => {
      const { supabase } = context;
      const { data, error } = await supabase.rpc("rpc_finalize_shopping_list", {
        p_list_id: args.list_id,
        p_purchase_date: args.data_compra ?? new Date().toISOString().slice(0, 10),
      });

      if (error) throw new Error(`Erro ao finalizar lista: ${error.message}`);
      return { content: [{ type: "text", text: JSON.stringify(data || {}, null, 2) }] };
    },
  );
};
