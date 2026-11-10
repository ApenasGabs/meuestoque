import { z } from "zod";
import { resolveGroupId, type AuthenticatedContext, type McpUserGroup } from "../auth";
import { extractContext, extractWriteContext } from "../context";
import { toUnit } from "../../types/inventory.types";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidIsoDate = (dateStr: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === dateStr;
};

const DUPLICATE_STOP_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "com",
  "sem",
  "para",
  "tipo",
  "un",
  "kg",
  "g",
  "ml",
  "l",
  "pct",
  "cx",
]);

const DUPLICATE_ABBREVIATIONS: Record<string, string> = {
  bov: "bovino",
  bovina: "bovino",
  suin: "suino",
  suina: "suino",
  frg: "frango",
  fgo: "frango",
  int: "integral",
  desn: "desnatado",
  desnat: "desnatado",
  semidesn: "semidesnatado",
  refri: "refrigerante",
  refrig: "refrigerante",
  bisc: "biscoito",
  bol: "bolacha",
  mus: "mussarela",
  muss: "mussarela",
};

/**
 * Normaliza o nome do item de estoque para comparação aproximada e deduplicação.
 * Remove acentuação, caracteres especiais e normaliza espaçamentos.
 *
 * @param name - Nome original do item de estoque
 * @returns Nome normalizado em minúsculas sem pontuação
 */
export const normalizeStockNameForComparison = (name: string): string =>
  name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const singularizeToken = (token: string): string => {
  if (token.length <= 3) return token;
  if (token.endsWith("oes") || token.endsWith("aes")) {
    return `${token.slice(0, -3)}ao`;
  }
  if (token.endsWith("is") && token.length > 4) {
    return `${token.slice(0, -2)}l`;
  }
  if (token.endsWith("ns") && token.length > 4) {
    return `${token.slice(0, -2)}m`;
  }
  if (token.endsWith("res") && token.length > 4) {
    return token.slice(0, -2);
  }
  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
};

/**
 * Segmenta o nome de um item em tokens léxicos normalizados, expandindo abreviações
 * conhecidas (ex: 'desn' -> 'desnatado') e removendo stop-words/unidades comuns.
 *
 * @param name - Nome do item de estoque
 * @returns Lista de tokens normalizados no singular
 */
export const tokenizeStockName = (name: string): string[] => {
  const normalized = normalizeStockNameForComparison(name);
  if (!normalized) return [];

  const tokens: string[] = [];
  for (const raw of normalized.split(/\s+/)) {
    if (!raw || DUPLICATE_STOP_WORDS.has(raw) || /^\d+$/.test(raw)) continue;
    const expanded = DUPLICATE_ABBREVIATIONS[raw] ?? raw;
    tokens.push(singularizeToken(expanded));
  }
  return tokens;
};

/**
 * Extrai a especificação de embalagem ou grandeza física de um nome de item de estoque
 * (massa, volume ou contagem/unidades), convertendo para unidades-base para comparação.
 *
 * @param name - Nome do item de estoque (ex: "Leite 1L", "Café 500g", "Ovos 1 dz")
 * @returns Especificação física detectada ou `null` se nenhuma grandeza for identificada
 */
export const extractPackageSpec = (
  name: string,
): { amount: number; dimension: "mass" | "volume" | "count"; baseUnits: number } | null => {
  const norm = normalizeStockNameForComparison(name);
  const regex = /\b(\d+(?:[.,]\d+)?)\s*(kg|quilos?|g|gramas?|l|litros?|ml|un|unidades?|duzias?|dz)\b/i;
  const match = norm.match(regex);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  if (Number.isNaN(num) || num <= 0) return null;
  const unitStr = match[2].toLowerCase();

  if (unitStr.startsWith("kg") || unitStr.startsWith("quilo")) {
    return { amount: num, dimension: "mass", baseUnits: num * 1000 };
  }
  if (unitStr === "g" || unitStr.startsWith("grama")) {
    return { amount: num, dimension: "mass", baseUnits: num };
  }
  if (unitStr === "l" || unitStr.startsWith("litro")) {
    return { amount: num, dimension: "volume", baseUnits: num * 1000 };
  }
  if (unitStr === "ml") {
    return { amount: num, dimension: "volume", baseUnits: num };
  }
  if (unitStr.startsWith("duzia") || unitStr === "dz") {
    return { amount: num, dimension: "count", baseUnits: num * 12 };
  }
  if (unitStr.startsWith("un")) {
    return { amount: num, dimension: "count", baseUnits: num };
  }
  return null;
};

/**
 * Calcula a similaridade entre dois nomes de itens de estoque (0 a 1).
 * Compara tokens normalizados e penaliza grandezas físicas ou embalagens incompatíveis
 * (ex: 20 unidades vs 5 dúzias, 397g vs 1kg).
 *
 * @param nameA - Primeiro nome de item para comparação
 * @param nameB - Segundo nome de item para comparação
 * @returns Coeficiente de similaridade entre 0 e 1
 */
export const computeStockNameSimilarity = (nameA: string, nameB: string): number => {
  const normA = normalizeStockNameForComparison(nameA);
  const normB = normalizeStockNameForComparison(nameB);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  // Penalizar a similaridade quando ambos os nomes especificarem grandezas numéricas ou unidades incompatíveis (ex: 20 unidades vs 5 duzias, 397g vs 1kg)
  const specA = extractPackageSpec(nameA);
  const specB = extractPackageSpec(nameB);
  if (specA && specB) {
    if (specA.dimension !== specB.dimension) {
      return 0.2;
    }
    const ratio =
      Math.min(specA.baseUnits, specB.baseUnits) / Math.max(specA.baseUnits, specB.baseUnits);
    if (ratio < 0.85) {
      return 0.2;
    }
  }

  const tokensA = tokenizeStockName(nameA);
  const tokensB = tokenizeStockName(nameB);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const keyA = [...new Set(tokensA)].sort().join(" ");
  const keyB = [...new Set(tokensB)].sort().join(" ");
  if (keyA === keyB) return 0.98;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let matches = 0;

  for (const tA of setA) {
    if (setB.has(tA)) {
      matches += 1;
    } else {
      for (const tB of setB) {
        if ((tA.length >= 4 && tB.startsWith(tA)) || (tB.length >= 4 && tA.startsWith(tB))) {
          matches += 0.85;
          break;
        }
      }
    }
  }

  return (2 * matches) / (setA.size + setB.size);
};

const verifyItemGroupAccess = (
  itemGroupId: string | undefined | null,
  groups: McpUserGroup[] | undefined,
  requestedGroupInput?: string,
): void => {
  const groupList = Array.isArray(groups) ? groups : [];

  if (requestedGroupInput) {
    const resolved = resolveGroupId(groupList, requestedGroupInput);
    if (resolved.error || !resolved.groupId) {
      throw new Error(resolved.error ?? "Acesso negado ao grupo especificado.");
    }
    if (itemGroupId && itemGroupId !== resolved.groupId) {
      throw new Error("Acesso negado ao grupo especificado.");
    }
    return;
  }

  if (itemGroupId && groupList.length > 0 && !groupList.some((g) => g.id === itemGroupId)) {
    throw new Error("Acesso negado ao grupo especificado.");
  }
};

export const registerStockTools = (server: unknown) => {
  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_stock_items",
    {
      title: "Get Stock Items",
      description:
        "Lista itens do estoque baseados num filtro (todos, em_estoque, baixo, vencendo, vencido, sem_validade, zerado)",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        filtro: z
          .enum(["todos", "em_estoque", "baixo", "vencendo", "vencido", "sem_validade", "zerado"])
          .default("todos"),
        dias_vencimento: z.number().int().default(7),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const resolved = resolveGroupId(context.groups, (args as { group_id?: string }).group_id);
      if (resolved.error || !resolved.groupId) {
        return {
          content: [{ type: "text", text: resolved.error ?? "Acesso negado ao grupo especificado." }],
        };
      }
      const groupId = resolved.groupId;

      const filtro = (args as { filtro?: string }).filtro ?? "todos";
      const diasVencimento = (args as { dias_vencimento?: number }).dias_vencimento ?? 7;

      let query = supabase
        .from("stock_items")
        .select(
          "id, nome, categoria, quantidade, quantidade_minima, unidade, data_compra, data_validade, data_validade_alerta, auto_adicionar_lista, validade_nao_aplica",
        )
        .eq("group_id", groupId);

      if (filtro === "em_estoque") {
        query = query.gt("quantidade", 0);
      } else if (filtro === "baixo") {
        // O filtro "baixo" é refinado em memória abaixo pois PostgREST não compara duas colunas diretamente sem RPC.
      } else if (filtro === "zerado") {
        query = query.lte("quantidade", 0);
      } else if (filtro === "sem_validade") {
        query = query
          .gt("quantidade", 0)
          .eq("validade_nao_aplica", false)
          .is("data_validade_alerta", null);
      } else if (filtro === "vencendo") {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + diasVencimento);
        query = query
          .gt("quantidade", 0)
          .eq("validade_nao_aplica", false)
          .lte("data_validade_alerta", threshold.toISOString().slice(0, 10));
      } else if (filtro === "vencido") {
        const today = new Date().toISOString().slice(0, 10);
        query = query
          .gt("quantidade", 0)
          .eq("validade_nao_aplica", false)
          .lt("data_validade_alerta", today);
      }

      const { data, error } = await query;
      if (error) {
        console.error(error);
        throw new Error(
          `Falha ao carregar itens do estoque: ${error.message || error.code || "erro no banco de dados"}`,
        );
      }

      const rows = Array.isArray(data) ? data : [];
      const resultRows =
        filtro === "baixo"
          ? rows.filter(
              (item: { quantidade?: number; quantidade_minima?: number }) =>
                (item.quantidade_minima ?? 0) > 0 &&
                (item.quantidade ?? 0) <= (item.quantidade_minima ?? 0),
            )
          : rows;

      return { content: [{ type: "text", text: JSON.stringify(resultRows, null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "consume_stock_item",
    {
      title: "Consume Stock Item",
      description:
        "Registra a saída ou baixa de um ou mais itens do estoque por consumo habitual, descarte de vencido ou perda, com suporte a baixa total ('consumir_tudo') e operação em lote",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        item_id: z.string().uuid().optional().describe("ID de um único item de estoque a dar baixa"),
        item_ids: z
          .array(z.string().uuid())
          .min(1)
          .optional()
          .describe("Lista de IDs de itens para baixa em lote"),
        quantidade: z
          .number()
          .positive()
          .optional()
          .describe("Quantidade a dar baixa (obrigatória se consumir_tudo for false e itens não for informado)"),
        consumir_tudo: z
          .boolean()
          .default(false)
          .describe("Se true, dá baixa em todo o saldo restante do item sem exigir informar a quantidade decimal"),
        itens: z
          .array(
            z.object({
              item_id: z.string().uuid().describe("ID do item"),
              quantidade: z.number().positive().optional().describe("Quantidade a baixar"),
              consumir_tudo: z
                .boolean()
                .optional()
                .describe("Se true, consome todo o saldo restante deste item"),
            }),
          )
          .min(1)
          .optional()
          .describe("Lista detalhada de itens para baixa em lote"),
        tipo: z
          .enum(["consumo", "descarte", "perda", "vencido", "saida"])
          .default("consumo")
          .describe(
            "Tipo/motivo da baixa: 'consumo' (uso habitual/alimentação), 'descarte' ou 'vencido' (estragou/expirou), ou 'perda' (avaria/quebra)",
          ),
        motivo: z
          .string()
          .optional()
          .describe("Observação ou justificativa detalhada da baixa"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase, userId } = context;
      const rawGroupId = (args as { group_id?: string }).group_id;

      if (rawGroupId && Array.isArray(context.groups) && context.groups.length > 0) {
        const resolved = resolveGroupId(context.groups, rawGroupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
      }

      type TargetConsumeItem = { item_id: string; quantidade?: number; consumir_tudo: boolean };
      let targets: TargetConsumeItem[] = [];

      const rawItens = (
        args as {
          itens?: Array<{ item_id: string; quantidade?: number; consumir_tudo?: boolean }>;
        }
      ).itens;
      const rawItemIds = (args as { item_ids?: string[] }).item_ids;
      const rawItemId = (args as { item_id?: string }).item_id;
      const globalConsumirTudo = Boolean((args as { consumir_tudo?: boolean }).consumir_tudo);
      const globalQuantidade = (args as { quantidade?: number }).quantidade;

      if (Array.isArray(rawItens) && rawItens.length > 0) {
        targets = rawItens.map((it) => ({
          item_id: it.item_id,
          quantidade: it.quantidade,
          consumir_tudo: Boolean(it.consumir_tudo ?? globalConsumirTudo),
        }));
      } else if (Array.isArray(rawItemIds) && rawItemIds.length > 0) {
        targets = rawItemIds.map((id) => ({
          item_id: id,
          quantidade: globalQuantidade,
          consumir_tudo: globalConsumirTudo,
        }));
      } else if (rawItemId) {
        targets = [
          {
            item_id: rawItemId,
            quantidade: globalQuantidade,
            consumir_tudo: globalConsumirTudo,
          },
        ];
      }

      if (targets.length === 0) {
        throw new Error(
          "Informe ao menos um item ('item_id', 'item_ids' ou 'itens') para dar baixa no estoque.",
        );
      }

      // Consolidar e deduplicar targets por item_id
      const consolidatedMap = new Map<string, TargetConsumeItem>();
      for (const t of targets) {
        const existing = consolidatedMap.get(t.item_id);
        if (!existing) {
          consolidatedMap.set(t.item_id, { ...t });
        } else {
          existing.consumir_tudo = existing.consumir_tudo || t.consumir_tudo;
          if (!existing.consumir_tudo) {
            const currentQty = existing.quantidade ?? 0;
            const addedQty = t.quantidade ?? 0;
            existing.quantidade = currentQty + addedQty > 0 ? currentQty + addedQty : undefined;
          } else {
            existing.quantidade = undefined;
          }
        }
      }
      targets = Array.from(consolidatedMap.values());

      for (const t of targets) {
        if (!UUID_REGEX.test(t.item_id)) {
          throw new Error("Todos os IDs de itens informados devem ser UUIDs válidos.");
        }
        if (!t.consumir_tudo && (!t.quantidade || t.quantidade <= 0)) {
          throw new Error(
            "Informe uma quantidade positiva ou utilize 'consumir_tudo: true' para dar baixa.",
          );
        }
      }

      type StockRow = {
        id: string;
        group_id: string;
        nome: string;
        quantidade: number;
        unidade?: string;
        data_validade?: string | null;
        data_validade_alerta?: string | null;
      };

      const targetIds = Array.from(new Set(targets.map((t) => t.item_id)));
      let foundItems: StockRow[] = [];
      if (typeof supabase.from === "function") {
        const { data: dbItems, error: fetchError } = await supabase
          .from("stock_items")
          .select("id, group_id, nome, quantidade, unidade, data_validade, data_validade_alerta")
          .in("id", targetIds);

        if (fetchError) {
          throw new Error(
            `Falha ao consultar itens de estoque: ${fetchError.message || fetchError.code || "erro no banco de dados"}`,
          );
        }

        foundItems = (Array.isArray(dbItems) ? dbItems : []) as StockRow[];
        if (foundItems.length !== targetIds.length) {
          throw new Error("Um ou mais itens de estoque não foram encontrados.");
        }

        for (const it of foundItems) {
          verifyItemGroupAccess(it.group_id, context.groups, rawGroupId);
        }
      }

      const rawTipo = (args as { tipo?: string }).tipo ?? "consumo";
      const effectiveTipo = rawTipo === "consumo" ? "saida" : rawTipo;
      const rawMotivo = (args as { motivo?: string }).motivo;
      const observacao =
        rawMotivo ??
        (rawTipo !== "consumo" && rawTipo !== "saida"
          ? `Baixa por ${rawTipo}`
          : "Consumo rápido");

      const itemSummaries: string[] = [];

      for (const target of targets) {
        const item = foundItems.find((f) => f.id === target.item_id);
        const itemNome = item?.nome ?? "Item de estoque";
        const itemUnidade = item?.unidade ?? "Un";
        const currentQty = item ? Number(item.quantidade) || 0 : (target.quantidade ?? 0);
        const qtyToConsume = target.consumir_tudo ? currentQty : Number(target.quantidade);

        if (qtyToConsume > 0) {
          const { error: rpcErr } = await supabase.rpc("consume_stock_fifo", {
            p_stock_item_id: target.item_id,
            p_quantidade: qtyToConsume,
            p_tipo: effectiveTipo,
            p_observacao: observacao,
            p_origem: "quick_consume",
            p_criado_por: userId,
          });

          if (rpcErr) {
            console.error("[MCP] consume_stock_fifo:", rpcErr.code, rpcErr.message);
            const detail = rpcErr.message ? `: ${rpcErr.message}` : "";
            throw new Error(`Falha ao consumir estoque${detail}`);
          }
        }

        const remaining = target.consumir_tudo ? 0 : Math.max(0, currentQty - qtyToConsume);
        if ((remaining <= 0 || target.consumir_tudo) && typeof supabase.from === "function") {
          // Limpa alerta de validade do item que zerou
          const { error: updateError } = await supabase
            .from("stock_items")
            .update({
              data_validade: null,
              data_validade_alerta: null,
            })
            .eq("id", target.item_id);

          if (updateError) {
            console.error("[MCP] Falha ao limpar alerta de validade de item zerado:", updateError);
            throw new Error(
              `Falha ao limpar alertas de validade do item zerado: ${updateError.message || updateError.code || "erro no banco de dados"}`,
            );
          }
        }

        itemSummaries.push(
          `${itemNome}: ${qtyToConsume} ${itemUnidade} baixado(s) (${
            remaining <= 0 ? "saldo zerado, alerta de validade limpo" : `saldo restante: ${remaining}`
          })`,
        );
      }

      const actionLabel =
        rawTipo === "descarte" || rawTipo === "vencido"
          ? "Descarte registrado com sucesso."
          : rawTipo === "perda"
            ? "Perda registrada com sucesso."
            : "Consumo registrado com sucesso.";

      const text =
        targets.length === 1
          ? `${actionLabel} (${itemSummaries[0]})`
          : `${actionLabel} (${targets.length} itens em lote):\n- ${itemSummaries.join("\n- ")}`;

      return { content: [{ type: "text", text }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_expiring_items",
    {
      title: "Get Expiring Items",
      description: "Lista itens que vencem nos próximos N dias ou apenas itens já vencidos",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        dias: z.number().int().min(0).max(90).default(7),
        apenas_vencidos: z
          .boolean()
          .default(false)
          .describe("Se true, retorna apenas os itens cuja validade já expirou"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const resolved = resolveGroupId(context.groups, (args as { group_id?: string }).group_id);
      if (resolved.error || !resolved.groupId) {
        return {
          content: [{ type: "text", text: resolved.error ?? "Acesso negado ao grupo especificado." }],
        };
      }
      const groupId = resolved.groupId;

      const apenasVencidos = Boolean((args as { apenas_vencidos?: boolean }).apenas_vencidos);
      const dias = (args as { dias?: number }).dias ?? 7;
      const today = new Date().toISOString().slice(0, 10);

      let baseQuery = supabase
        .from("stock_items")
        .select("id, nome, quantidade, unidade, data_validade_alerta")
        .eq("group_id", groupId)
        .eq("validade_nao_aplica", false)
        .gt("quantidade", 0);

      if (apenasVencidos) {
        baseQuery = baseQuery.lt("data_validade_alerta", today);
      } else {
        const threshold = new Date();
        threshold.setDate(threshold.getDate() + dias);
        baseQuery = baseQuery.lte("data_validade_alerta", threshold.toISOString().slice(0, 10));
      }

      const { data, error } = await baseQuery.order("data_validade_alerta", { ascending: true });

      if (error) {
        console.error(error);
        throw new Error(
          `Falha ao carregar itens a vencer: ${error.message || error.code || "erro no banco de dados"}`,
        );
      }
      return { content: [{ type: "text", text: JSON.stringify(data || [], null, 2) }] };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "get_low_stock_items",
    {
      title: "Get Low Stock Items",
      description: "Lista itens abaixo da quantidade mínima configurada",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;
      const resolved = resolveGroupId(context.groups, (args as { group_id?: string }).group_id);
      if (resolved.error || !resolved.groupId) {
        return {
          content: [{ type: "text", text: resolved.error ?? "Acesso negado ao grupo especificado." }],
        };
      }
      const groupId = resolved.groupId;

      const { data, error } = await supabase
        .from("stock_items")
        .select("id, nome, quantidade, quantidade_minima, unidade, categoria")
        .eq("group_id", groupId)
        .gt("quantidade_minima", 0);

      if (error) {
        console.error(error);
        throw new Error(
          `Falha ao carregar itens com estoque baixo: ${error.message || error.code || "erro no banco de dados"}`,
        );
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
        "Atualiza a data de validade de um ou mais itens do estoque, calcula validade relativa por prazo em dias ('prazo_dias') ou marca como 'Não se aplica' (não perecível)",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
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
          .describe(
            "Nova data de validade no formato YYYY-MM-DD (obrigatória quando nao_aplica for false e prazo_dias não informado)",
          ),
        prazo_dias: z
          .number()
          .int()
          .positive()
          .optional()
          .describe(
            "Prazo de validade em dias a partir da data de compra ou de hoje (ex: 14 para 2 semanas, 365 para 1 ano)",
          ),
        base_calculo: z
          .enum(["data_compra", "hoje"])
          .default("data_compra")
          .describe("Base para o cálculo com prazo_dias: 'data_compra' (padrão) ou 'hoje'"),
        nao_aplica: z
          .boolean()
          .default(false)
          .describe("Se true, marca o(s) item(ns) como 'Não se aplica' (não perecível) e limpa a data de validade"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase } = context;
      const groups = context.groups;
      const groupId = (args as { group_id?: string }).group_id;

      if (groupId && Array.isArray(groups) && groups.length > 0) {
        const resolved = resolveGroupId(groups, groupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
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

      if (!itemIds.every((id) => UUID_REGEX.test(id))) {
        throw new Error("Todos os IDs de itens informados devem ser UUIDs válidos.");
      }

      const naoAplica = Boolean((args as { nao_aplica?: boolean }).nao_aplica);
      const dataValidade = (args as { data_validade?: string }).data_validade;
      const rawPrazoDias = (args as { prazo_dias?: number }).prazo_dias;
      const prazoDias =
        rawPrazoDias !== undefined && !Number.isNaN(Number(rawPrazoDias)) && Number(rawPrazoDias) > 0
          ? Number(rawPrazoDias)
          : undefined;
      const baseCalculo =
        (args as { base_calculo?: "data_compra" | "hoje" }).base_calculo ?? "data_compra";

      if (!naoAplica) {
        if (!dataValidade && prazoDias === undefined) {
          throw new Error(
            "Informe 'data_validade' (YYYY-MM-DD), 'prazo_dias' (número de dias) ou defina 'nao_aplica' como true para itens não perecíveis.",
          );
        }
        if (dataValidade) {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dataValidade)) {
            throw new Error("Formato inválido para 'data_validade'. Use YYYY-MM-DD.");
          }
          if (!isValidIsoDate(dataValidade)) {
            throw new Error("Data de validade inválida. Informe uma data real no formato YYYY-MM-DD.");
          }
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      let fallbackHojeCount = 0;
      let catalogLearningCount = 0;

      // Mapa de data calculada/especificada -> IDs a atualizar
      const updatesMap = new Map<string | null, string[]>();

      if (naoAplica) {
        updatesMap.set(null, itemIds);
      } else if (dataValidade && prazoDias === undefined) {
        updatesMap.set(dataValidade, itemIds);
      } else if (prazoDias !== undefined) {
        const { data: dbItems, error: itemsFetchError } = await supabase
          .from("stock_items")
          .select("id, group_id, nome, product_id, data_compra")
          .in("id", itemIds);

        if (itemsFetchError) {
          throw new Error(
            `Falha ao consultar itens para cálculo de validade: ${itemsFetchError.message || itemsFetchError.code || "erro no banco de dados"}`,
          );
        }

        type StockValidityRow = {
          id: string;
          group_id: string;
          nome: string;
          product_id?: string | null;
          data_compra?: string | null;
        };

        const fetchedItems = (Array.isArray(dbItems) ? dbItems : []) as StockValidityRow[];

        for (const it of fetchedItems) {
          let baseDate = it.data_compra;
          if (baseCalculo === "data_compra" && !baseDate) {
            const { data: lotData } = await supabase
              .from("stock_lots")
              .select("data_compra")
              .eq("stock_item_id", it.id)
              .not("data_compra", "is", null)
              .order("data_compra", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (lotData && (lotData as { data_compra?: string }).data_compra) {
              baseDate = (lotData as { data_compra: string }).data_compra;
            } else {
              baseDate = today;
              fallbackHojeCount += 1;
            }
          } else if (baseCalculo === "hoje" || !baseDate) {
            baseDate = today;
          }

          const baseObj = new Date(`${baseDate}T00:00:00.000Z`);
          baseObj.setUTCDate(baseObj.getUTCDate() + prazoDias);
          const computedDate = baseObj.toISOString().slice(0, 10);

          const bucket = updatesMap.get(computedDate) ?? [];
          bucket.push(it.id);
          updatesMap.set(computedDate, bucket);

          // Catalog Learning: atualizar product_catalog.validade_padrao_dias
          if (it.product_id) {
            const { error: catErr } = await supabase
              .from("product_catalog")
              .update({ validade_padrao_dias: prazoDias, perecivel: true })
              .eq("id", it.product_id);
            if (!catErr) {
              catalogLearningCount += 1;
            } else {
              console.error("[MCP] Falha ao atualizar catálogo do produto:", catErr);
            }
          } else if (it.group_id && it.nome) {
            const { data: catMatch, error: matchErr } = await supabase
              .from("product_catalog")
              .select("id")
              .eq("group_id", it.group_id)
              .ilike("nome", it.nome)
              .maybeSingle();

            if (!matchErr && catMatch && (catMatch as { id?: string }).id) {
              const { error: catErr } = await supabase
                .from("product_catalog")
                .update({ validade_padrao_dias: prazoDias, perecivel: true })
                .eq("id", (catMatch as { id: string }).id);
              if (!catErr) {
                catalogLearningCount += 1;
              } else {
                console.error("[MCP] Falha ao atualizar catálogo do produto por nome:", catErr);
              }
            }
          }
        }
      }

      for (const [targetDate, ids] of updatesMap.entries()) {
        const { error } = await supabase.rpc("rpc_bulk_update_stock_validity", {
          p_item_ids: ids,
          p_data_validade: naoAplica ? null : targetDate,
          p_nao_aplica: naoAplica,
        });

        if (error) {
          console.error("[MCP] rpc_bulk_update_stock_validity:", error.code, error.message);
          const detail = error.message ? `: ${error.message}` : "";
          throw new Error(`Falha ao atualizar validade do estoque${detail}`);
        }
      }

      const count = itemIds.length;
      const itemLabel = count === 1 ? "1 item atualizado" : `${count} itens atualizados`;
      const dateList = Array.from(updatesMap.keys()).filter(Boolean);
      let statusDetail = naoAplica
        ? "marcado(s) como 'Não se aplica' (não perecível)"
        : `validade definida para ${dateList.join(", ")}`;

      if (prazoDias !== undefined) {
        statusDetail += ` (+${prazoDias} dias a partir de ${baseCalculo === "data_compra" ? "data de compra" : "hoje"})`;
      }
      if (fallbackHojeCount > 0) {
        statusDetail += ` (fallback para 'hoje' utilizado em ${fallbackHojeCount} item(ns) sem data de compra)`;
      }
      if (catalogLearningCount > 0) {
        statusDetail += ` (catálogo aprendido: validade padrão de ${prazoDias} dias)`;
      }

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

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "add_stock_item",
    {
      title: "Add Stock Item",
      description:
        "Cria um item no estoque (ex: carga de estoque inicial pré-existente) e registra movimentação auditada",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        nome: z.string().min(1).describe("Nome do item de estoque"),
        categoria: z.string().default("Outros").describe("Categoria do item"),
        quantidade: z.number().min(0).default(1).describe("Quantidade inicial em estoque"),
        quantidade_minima: z
          .number()
          .min(0)
          .default(0)
          .describe("Quantidade mínima para alerta de reposição"),
        unidade: z
          .string()
          .default("Un")
          .describe("Unidade de medida (Un, Kg, g, L, mL, cx, pct)"),
        origem: z
          .enum(["estoque_inicial", "cadastro_manual"])
          .default("estoque_inicial")
          .describe(
            "Origem do item: 'estoque_inicial' (itens já existentes na despensa antes do uso do app) ou 'cadastro_manual'",
          ),
        data_validade: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: YYYY-MM-DD")
          .optional()
          .describe("Data de validade no formato YYYY-MM-DD (opcional)"),
        nao_aplica: z
          .boolean()
          .default(false)
          .describe("Se true, marca o item como não perecível ('Não se aplica')"),
        auto_adicionar_lista: z
          .boolean()
          .default(false)
          .describe("Se true, adiciona automaticamente na lista de compras ao atingir o mínimo"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase, userId } = context;

      const resolved = resolveGroupId(context.groups, (args as { group_id?: string }).group_id);
      if (resolved.error || !resolved.groupId) {
        throw new Error(resolved.error ?? "Acesso negado ao grupo especificado.");
      }
      const groupId = resolved.groupId;

      const nome = String((args as { nome?: string }).nome ?? "").trim();
      if (!nome) {
        throw new Error("Informe o nome do item de estoque.");
      }

      const quantidade = Number((args as { quantidade?: number }).quantidade ?? 1);
      if (Number.isNaN(quantidade) || quantidade < 0) {
        throw new Error("A quantidade deve ser maior ou igual a zero.");
      }

      const quantidadeMinima = Number(
        (args as { quantidade_minima?: number }).quantidade_minima ?? 0,
      );
      if (Number.isNaN(quantidadeMinima) || quantidadeMinima < 0) {
        throw new Error("A quantidade mínima deve ser maior ou igual a zero.");
      }

      const naoAplica = Boolean((args as { nao_aplica?: boolean }).nao_aplica);
      const rawValidade = (args as { data_validade?: string }).data_validade;

      if (!naoAplica && rawValidade) {
        if (!isValidIsoDate(rawValidade)) {
          throw new Error("Data de validade inválida. Informe uma data real no formato YYYY-MM-DD.");
        }
      }

      const effectiveValidade = naoAplica ? null : (rawValidade ?? null);
      const categoria =
        String((args as { categoria?: string }).categoria ?? "Outros").trim() || "Outros";
      const unidade = toUnit((args as { unidade?: string }).unidade ?? "Un");
      const origemCadastro = (args as { origem?: string }).origem ?? "estoque_inicial";
      const autoAdicionarLista = Boolean(
        (args as { auto_adicionar_lista?: boolean }).auto_adicionar_lista,
      );
      const today = new Date().toISOString().slice(0, 10);

      const insertPayload = {
        group_id: groupId,
        nome,
        categoria,
        unidade,
        quantidade,
        quantidade_atual: quantidade,
        quantidade_minima: quantidadeMinima,
        tamanho_porcao: 1,
        na_lista: false,
        auto_adicionar_lista: autoAdicionarLista,
        consumo_frequencia: "weekly",
        consumo_valor: 0,
        data_compra: quantidade > 0 ? today : null,
        data_validade: effectiveValidade,
        data_validade_alerta: effectiveValidade,
        validade_nao_aplica: naoAplica,
      };

      const { data: createdItem, error: insertError } = await supabase
        .from("stock_items")
        .insert(insertPayload)
        .select(
          "id, group_id, nome, categoria, unidade, quantidade, quantidade_minima, data_validade_alerta, validade_nao_aplica, auto_adicionar_lista",
        )
        .maybeSingle();

      if (insertError) {
        throw new Error(
          `Falha ao adicionar item no estoque: ${insertError.message || insertError.code || "erro no banco de dados"}`,
        );
      }

      if (quantidade > 0 && createdItem && (createdItem as { id?: string }).id) {
        const { error: movementError } = await supabase.from("stock_movements").insert({
          item_id: (createdItem as { id: string }).id,
          stock_item_id: (createdItem as { id: string }).id,
          tipo: origemCadastro === "estoque_inicial" ? "estoque_inicial" : "entrada",
          quantidade,
          unidade,
          observacao:
            origemCadastro === "estoque_inicial"
              ? "Carga de estoque inicial pré-existente"
              : "Cadastro manual de item",
          origem: origemCadastro === "estoque_inicial" ? "initial_stock" : "manual_entry",
          criado_por: userId,
        });

        if (movementError) {
          console.error("[MCP] Falha ao registrar movimentação de estoque inicial:", movementError);
          throw new Error(
            `Falha ao registrar movimentação no histórico de estoque: ${movementError.message || movementError.code || "erro no banco de dados"}`,
          );
        }
      }

      const itemSummary = createdItem ?? { ...insertPayload };
      return {
        content: [
          {
            type: "text",
            text: `Item '${nome}' adicionado ao estoque com sucesso.\n${JSON.stringify(itemSummary, null, 2)}`,
          },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "set_stock_quantity",
    {
      title: "Set Stock Quantity",
      description:
        "Realiza a correção auditada de quantidade de um item do estoque (inventário ou erro na nota fiscal) e registra auditoria em stock_movements com tipo = 'ajuste'",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        item_id: z.string().uuid().describe("ID do item de estoque"),
        quantidade: z.number().min(0).describe("Nova quantidade correta em estoque (>= 0)"),
        motivo: z
          .string()
          .optional()
          .describe("Motivo ou justificativa da correção (ex: 'Erro na nota fiscal', 'Contagem física divergente')"),
        observacao: z
          .string()
          .optional()
          .describe("Observação adicional da correção auditada"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase, userId } = context;

      const itemId = String((args as { item_id?: string }).item_id ?? "");
      if (!UUID_REGEX.test(itemId)) {
        throw new Error("ID do item inválido. Informe um UUID válido.");
      }

      const novaQuantidade = Number((args as { quantidade?: number }).quantidade);
      if (Number.isNaN(novaQuantidade) || !Number.isFinite(novaQuantidade) || novaQuantidade < 0) {
        throw new Error("A quantidade deve ser um número maior ou igual a zero.");
      }

      const rawGroupId = (args as { group_id?: string }).group_id;
      if (rawGroupId) {
        const resolved = resolveGroupId(context.groups, rawGroupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from("stock_items")
        .select("id, group_id, nome, quantidade, unidade")
        .eq("id", itemId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(
          `Falha ao consultar item de estoque: ${fetchError.message || fetchError.code || "erro no banco de dados"}`,
        );
      }
      if (!existingItem) {
        throw new Error("Item de estoque não encontrado.");
      }

      verifyItemGroupAccess(
        (existingItem as { group_id?: string }).group_id,
        context.groups,
        rawGroupId,
      );

      const previousQuantity = Number((existingItem as { quantidade?: number }).quantidade ?? 0);
      const unidade = String((existingItem as { unidade?: string }).unidade ?? "Un");
      const itemNome = String((existingItem as { nome?: string }).nome ?? itemId);

      const { error: updateError } = await supabase
        .from("stock_items")
        .update({
          quantidade: novaQuantidade,
          quantidade_atual: novaQuantidade,
        })
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Falha ao ajustar quantidade do estoque: ${updateError.message || updateError.code || "erro no banco de dados"}`,
        );
      }

      const justificativa =
        (args as { motivo?: string }).motivo?.trim() ||
        (args as { observacao?: string }).observacao?.trim() ||
        "Balanço de inventário";
      const observacao = `[Correção Auditada] ${justificativa} (${previousQuantity} -> ${novaQuantidade})`;

      const { error: movementError } = await supabase.from("stock_movements").insert({
        item_id: itemId,
        stock_item_id: itemId,
        tipo: "ajuste",
        quantidade: novaQuantidade,
        unidade,
        observacao,
        origem: "adjustment",
        criado_por: userId,
      });

      if (movementError) {
        throw new Error(
          `Falha ao registrar auditoria de ajuste: ${movementError.message || movementError.code || "erro no banco de dados"}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `Quantidade de '${itemNome}' ajustada com sucesso: ${previousQuantity} -> ${novaQuantidade} ${unidade}.`,
          },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "update_stock_item",
    {
      title: "Update Stock Item",
      description:
        "Edita metadados de um item de estoque (nome, categoria, unidade, quantidade mínima, auto_adicionar_lista)",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        item_id: z.string().uuid().describe("ID do item de estoque a editar"),
        nome: z.string().min(1).optional().describe("Novo nome do item"),
        categoria: z.string().min(1).optional().describe("Nova categoria do item"),
        unidade: z.string().min(1).optional().describe("Nova unidade de medida"),
        quantidade_minima: z.number().min(0).optional().describe("Nova quantidade mínima"),
        auto_adicionar_lista: z
          .boolean()
          .optional()
          .describe("Se deve adicionar automaticamente à lista de compras quando o estoque baixar"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase } = context;

      const itemId = String((args as { item_id?: string }).item_id ?? "");
      if (!UUID_REGEX.test(itemId)) {
        throw new Error("ID do item inválido. Informe um UUID válido.");
      }

      const rawGroupId = (args as { group_id?: string }).group_id;
      if (rawGroupId) {
        const resolved = resolveGroupId(context.groups, rawGroupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
      }

      const updatePayload: Record<string, unknown> = {};

      if ((args as { nome?: string }).nome !== undefined) {
        const nome = String((args as { nome?: string }).nome).trim();
        if (!nome) {
          throw new Error("O nome do item não pode ser vazio.");
        }
        updatePayload.nome = nome;
      }

      if ((args as { categoria?: string }).categoria !== undefined) {
        const categoria = String((args as { categoria?: string }).categoria).trim();
        if (!categoria) {
          throw new Error("A categoria não pode ser vazia.");
        }
        updatePayload.categoria = categoria;
      }

      if ((args as { unidade?: string }).unidade !== undefined) {
        updatePayload.unidade = toUnit(String((args as { unidade?: string }).unidade));
      }

      if ((args as { quantidade_minima?: number }).quantidade_minima !== undefined) {
        const qMin = Number((args as { quantidade_minima?: number }).quantidade_minima);
        if (Number.isNaN(qMin) || qMin < 0) {
          throw new Error("A quantidade mínima deve ser maior ou igual a zero.");
        }
        updatePayload.quantidade_minima = qMin;
      }

      if ((args as { auto_adicionar_lista?: boolean }).auto_adicionar_lista !== undefined) {
        updatePayload.auto_adicionar_lista = Boolean(
          (args as { auto_adicionar_lista?: boolean }).auto_adicionar_lista,
        );
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new Error(
          "Informe ao menos um campo para atualizar (nome, categoria, unidade, quantidade_minima ou auto_adicionar_lista).",
        );
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from("stock_items")
        .select("id, group_id, nome")
        .eq("id", itemId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(
          `Falha ao consultar item de estoque: ${fetchError.message || fetchError.code || "erro no banco de dados"}`,
        );
      }
      if (!existingItem) {
        throw new Error("Item de estoque não encontrado.");
      }

      verifyItemGroupAccess(
        (existingItem as { group_id?: string }).group_id,
        context.groups,
        rawGroupId,
      );

      const { error: updateError } = await supabase
        .from("stock_items")
        .update(updatePayload)
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Falha ao atualizar item de estoque: ${updateError.message || updateError.code || "erro no banco de dados"}`,
        );
      }

      const finalName = String(
        updatePayload.nome ?? (existingItem as { nome?: string }).nome ?? itemId,
      );
      return {
        content: [
          {
            type: "text",
            text: `Item '${finalName}' atualizado com sucesso.`,
          },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "delete_stock_item",
    {
      title: "Delete Stock Item",
      description: "Exclui um item do estoque com validação de grupo",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        item_id: z.string().uuid().describe("ID do item de estoque a excluir"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase } = context;

      const itemId = String((args as { item_id?: string }).item_id ?? "");
      if (!UUID_REGEX.test(itemId)) {
        throw new Error("ID do item inválido. Informe um UUID válido.");
      }

      const rawGroupId = (args as { group_id?: string }).group_id;
      if (rawGroupId) {
        const resolved = resolveGroupId(context.groups, rawGroupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
      }

      const { data: existingItem, error: fetchError } = await supabase
        .from("stock_items")
        .select("id, group_id, nome")
        .eq("id", itemId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(
          `Falha ao consultar item de estoque: ${fetchError.message || fetchError.code || "erro no banco de dados"}`,
        );
      }
      if (!existingItem) {
        throw new Error("Item de estoque não encontrado.");
      }

      verifyItemGroupAccess(
        (existingItem as { group_id?: string }).group_id,
        context.groups,
        rawGroupId,
      );

      const { error: deleteError } = await supabase.from("stock_items").delete().eq("id", itemId);
      if (deleteError) {
        throw new Error(
          `Falha ao excluir item de estoque: ${deleteError.message || deleteError.code || "erro no banco de dados"}`,
        );
      }

      const itemNome = String((existingItem as { nome?: string }).nome ?? itemId);
      return {
        content: [
          {
            type: "text",
            text: `Item '${itemNome}' excluído do estoque com sucesso.`,
          },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "find_duplicate_stock_items",
    {
      title: "Find Duplicate Stock Items",
      description:
        "Detecta itens duplicados ou similares no estoque do grupo por normalização textual e similaridade de tokens",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        limiar_similaridade: z
          .number()
          .min(0.5)
          .max(1)
          .default(0.75)
          .describe("Limiar de similaridade entre 0.5 e 1.0 (padrão 0.75)"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractContext(extra);
      const { supabase } = context;

      const resolved = resolveGroupId(context.groups, (args as { group_id?: string }).group_id);
      if (resolved.error || !resolved.groupId) {
        return {
          content: [{ type: "text", text: resolved.error ?? "Acesso negado ao grupo especificado." }],
        };
      }
      const groupId = resolved.groupId;

      const threshold = Number(
        (args as { limiar_similaridade?: number }).limiar_similaridade ?? 0.75,
      );

      const { data, error } = await supabase
        .from("stock_items")
        .select(
          "id, nome, categoria, quantidade, quantidade_minima, unidade, data_validade_alerta, validade_nao_aplica",
        )
        .eq("group_id", groupId);

      if (error) {
        console.error(error);
        throw new Error(
          `Falha ao buscar itens para detecção de duplicados: ${error.message || error.code || "erro no banco de dados"}`,
        );
      }

      type CandidateStockRow = {
        id: string;
        nome: string;
        categoria?: string;
        quantidade?: number;
        quantidade_minima?: number;
        unidade?: string;
        data_validade_alerta?: string | null;
        validade_nao_aplica?: boolean;
      };

      const items = (Array.isArray(data) ? data : []) as CandidateStockRow[];
      const parent = items.map((_, idx) => idx);
      const findRoot = (i: number): number => {
        let root = i;
        while (parent[root] !== root) root = parent[root];
        let curr = i;
        while (curr !== root) {
          const nxt = parent[curr];
          parent[curr] = root;
          curr = nxt;
        }
        return root;
      };
      const union = (i: number, j: number) => {
        const rootI = findRoot(i);
        const rootJ = findRoot(j);
        if (rootI !== rootJ) parent[rootJ] = rootI;
      };

      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const sim = computeStockNameSimilarity(items[i].nome, items[j].nome);
          if (sim >= threshold) {
            union(i, j);
          }
        }
      }

      const clustersMap = new Map<number, CandidateStockRow[]>();
      for (let i = 0; i < items.length; i++) {
        const root = findRoot(i);
        const bucket = clustersMap.get(root) ?? [];
        bucket.push(items[i]);
        clustersMap.set(root, bucket);
      }

      const duplicateGroups = Array.from(clustersMap.values())
        .filter((cluster) => cluster.length >= 2)
        .map((cluster) => {
          const sorted = [...cluster].sort(
            (a, b) => (Number(b.quantidade) || 0) - (Number(a.quantidade) || 0),
          );
          const primary = sorted[0];
          const totalQty = cluster.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0);
          const hasActive = cluster.some((item) => (Number(item.quantidade) || 0) > 0);
          const hasZero = cluster.some((item) => (Number(item.quantidade) || 0) <= 0);
          const possui_item_zerado = hasActive && hasZero;

          return {
            chave_normalizada:
              tokenizeStockName(primary.nome).join(" ") ||
              normalizeStockNameForComparison(primary.nome),
            sugestao_item_principal_id: primary.id,
            sugestao_item_principal_nome: primary.nome,
            quantidade_total: totalQty,
            possui_item_zerado,
            itens: cluster,
          };
        });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_grupos_duplicados: duplicateGroups.length,
                duplicados: duplicateGroups,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  (server as { registerTool: (name: string, config: unknown, handler: unknown) => void }).registerTool(
    "merge_stock_items",
    {
      title: "Merge Stock Items",
      description:
        "Mescla itens duplicados de estoque em um item alvo (principal), consolidando quantidade, lotes e histórico de movimentações",
      inputSchema: z.object({
        group_id: z
          .string()
          .optional()
          .describe("ID ou nome do grupo. Opcional caso o usuário só tenha 1 grupo"),
        target_item_id: z
          .string()
          .uuid()
          .describe("ID do item principal (alvo) que permanecerá no estoque"),
        source_item_id: z
          .string()
          .uuid()
          .optional()
          .describe("ID de um único item duplicado a ser mesclado e removido"),
        source_item_ids: z
          .array(z.string().uuid())
          .min(1)
          .optional()
          .describe("Lista de IDs dos itens duplicados a serem mesclados e removidos"),
        somar_quantidades: z
          .boolean()
          .default(true)
          .describe("Se true (padrão), soma as quantidades dos itens duplicados ao item alvo"),
      }),
    },
    async (args: Record<string, unknown>, extra: { authInfo?: AuthenticatedContext }) => {
      const context = extractWriteContext(extra);
      const { supabase, userId } = context;

      const targetItemId = String((args as { target_item_id?: string }).target_item_id ?? "");
      if (!UUID_REGEX.test(targetItemId)) {
        throw new Error("ID do item alvo ('target_item_id') inválido. Informe um UUID válido.");
      }

      const rawSourceIds = (args as { source_item_ids?: string[] }).source_item_ids;
      const rawSourceId = (args as { source_item_id?: string }).source_item_id;
      const combinedSourceIds = Array.from(
        new Set([
          ...(Array.isArray(rawSourceIds) ? rawSourceIds : []),
          ...(rawSourceId ? [rawSourceId] : []),
        ]),
      ).filter((id) => id !== targetItemId);

      if (combinedSourceIds.length === 0) {
        throw new Error(
          "Informe ao menos um item duplicado distinto do item principal ('source_item_id' ou 'source_item_ids').",
        );
      }

      if (!combinedSourceIds.every((id) => UUID_REGEX.test(id))) {
        throw new Error("Todos os IDs de itens duplicados devem ser UUIDs válidos.");
      }

      const rawGroupId = (args as { group_id?: string }).group_id;
      if (rawGroupId) {
        const resolved = resolveGroupId(context.groups, rawGroupId);
        if (resolved.error) {
          throw new Error(resolved.error);
        }
      }

      const allIds = [targetItemId, ...combinedSourceIds];
      const { data: foundItems, error: fetchError } = await supabase
        .from("stock_items")
        .select(
          "id, group_id, nome, categoria, quantidade, quantidade_minima, unidade, data_validade, data_validade_alerta, validade_nao_aplica, auto_adicionar_lista",
        )
        .in("id", allIds);

      if (fetchError) {
        throw new Error(
          `Falha ao consultar itens para mesclagem: ${fetchError.message || fetchError.code || "erro no banco de dados"}`,
        );
      }

      type MergeStockRow = {
        id: string;
        group_id?: string;
        nome: string;
        categoria?: string;
        quantidade?: number;
        quantidade_minima?: number;
        unidade?: string;
        data_validade?: string | null;
        data_validade_alerta?: string | null;
        validade_nao_aplica?: boolean;
        auto_adicionar_lista?: boolean;
      };

      const rows = (Array.isArray(foundItems) ? foundItems : []) as MergeStockRow[];
      const targetItem = rows.find((r) => r.id === targetItemId);
      if (!targetItem) {
        throw new Error("Item principal (alvo) não encontrado.");
      }

      const sourceItems = rows.filter((r) => combinedSourceIds.includes(r.id));
      if (sourceItems.length !== combinedSourceIds.length) {
        throw new Error("Um ou mais itens duplicados de origem não foram encontrados.");
      }

      verifyItemGroupAccess(targetItem.group_id, context.groups, rawGroupId);
      if (
        targetItem.group_id &&
        sourceItems.some((s) => s.group_id && s.group_id !== targetItem.group_id)
      ) {
        throw new Error("Todos os itens da mesclagem devem pertencer ao mesmo grupo.");
      }

      const somarQuantidades = (args as { somar_quantidades?: boolean }).somar_quantidades !== false;
      const addedQuantity = somarQuantidades
        ? sourceItems.reduce((acc, item) => acc + (Number(item.quantidade) || 0), 0)
        : 0;
      const finalQuantity = (Number(targetItem.quantidade) || 0) + addedQuantity;
      const finalMinQuantity = Math.max(
        Number(targetItem.quantidade_minima) || 0,
        ...sourceItems.map((s) => Number(s.quantidade_minima) || 0),
      );

      const candidateDates = [targetItem, ...sourceItems]
        .map((item) => item.data_validade_alerta ?? item.data_validade ?? null)
        .filter((d): d is string => typeof d === "string" && d.length > 0)
        .sort();
      const earliestValidity = candidateDates[0] ?? null;

      // 1. Reatribuir lotes (stock_lots) dos itens duplicados para o item principal
      const { error: lotsError } = await supabase
        .from("stock_lots")
        .update({ stock_item_id: targetItemId })
        .in("stock_item_id", combinedSourceIds);

      if (lotsError) {
        throw new Error(
          `Falha ao transferir lotes na mesclagem: ${lotsError.message || lotsError.code || "erro no banco de dados"}`,
        );
      }

      // 2. Reatribuir movimentações (stock_movements) dos itens duplicados para o item principal
      const { error: movementsTransferError } = await supabase
        .from("stock_movements")
        .update({ item_id: targetItemId, stock_item_id: targetItemId })
        .in("stock_item_id", combinedSourceIds);

      if (movementsTransferError) {
        throw new Error(
          `Falha ao transferir histórico de movimentações na mesclagem: ${movementsTransferError.message || movementsTransferError.code || "erro no banco de dados"}`,
        );
      }

      // 3. Remover os itens duplicados de origem
      const { error: deleteError } = await supabase
        .from("stock_items")
        .delete()
        .in("id", combinedSourceIds);

      if (deleteError) {
        throw new Error(
          `Falha ao remover itens duplicados após mesclagem: ${deleteError.message || deleteError.code || "erro no banco de dados"}`,
        );
      }

      // 4. Atualizar saldo e metadados consolidados no item principal
      const targetUpdatePayload: Record<string, unknown> = {
        quantidade: finalQuantity,
        quantidade_atual: finalQuantity,
        quantidade_minima: finalMinQuantity,
        auto_adicionar_lista:
          Boolean(targetItem.auto_adicionar_lista) ||
          sourceItems.some((s) => Boolean(s.auto_adicionar_lista)),
      };

      if (!targetItem.validade_nao_aplica && earliestValidity) {
        targetUpdatePayload.data_validade = earliestValidity;
        targetUpdatePayload.data_validade_alerta = earliestValidity;
      }

      const { error: updateTargetError } = await supabase
        .from("stock_items")
        .update(targetUpdatePayload)
        .eq("id", targetItemId);

      if (updateTargetError) {
        throw new Error(
          `Falha ao atualizar item principal na mesclagem: ${updateTargetError.message || updateTargetError.code || "erro no banco de dados"}`,
        );
      }

      // 5. Registrar auditoria da mesclagem em stock_movements
      const mergedNames = sourceItems.map((s) => s.nome).join(", ");
      const { error: auditError } = await supabase.from("stock_movements").insert({
        item_id: targetItemId,
        stock_item_id: targetItemId,
        tipo: "ajuste",
        quantidade: finalQuantity,
        unidade: targetItem.unidade ?? "Un",
        observacao: `Mesclagem de duplicados (${mergedNames}) no item '${targetItem.nome}'`,
        origem: "merge",
        criado_por: userId,
      });

      if (auditError) {
        throw new Error(
          `Falha ao registrar auditoria da mesclagem: ${auditError.message || auditError.code || "erro no banco de dados"}`,
        );
      }

      return {
        content: [
          {
            type: "text",
            text: `Mesclagem concluída com sucesso: ${sourceItems.length} item(ns) duplicado(s) (${mergedNames}) consolidado(s) em '${targetItem.nome}'. Quantidade final: ${finalQuantity} ${targetItem.unidade ?? "Un"}.`,
          },
        ],
      };
    },
  );
};
