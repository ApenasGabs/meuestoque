import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { Input } from "../components/Input/Input";
import { StockHistoryModal } from "../components/StockHistoryModal";
import { StockItemModal } from "../components/StockItemModal";
import { Textarea } from "../components/Textarea/Textarea";
import { parseStockImportText, type ParsedStockImportItem, type StockImportSource } from "../domain/stockImportParser";
import { useWakeLock } from "../hooks/useWakeLock";
import { supabase } from "../lib/supabase";
import {
  runAutoConsumption,
  type StockItemRecord,
  type UpsertStockItemInput,
} from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";
import { useStockStore } from "../stores/stockStore";

const categoryOrder = [
  "Todos",
  "Hortifruti",
  "Carnes",
  "Laticinios",
  "Limpeza",
  "Higiene",
  "Graos e secos",
  "Bebidas",
  "Pet",
  "Outros",
];

const getStockStatus = (
  item: StockItemRecord,
): { label: string; variant: "success" | "warning" | "error" } => {
  if (item.quantidade === 0) return { label: "Sem estoque", variant: "error" };
  if (item.quantidade <= item.quantidade_minima * 1.2) {
    return { label: "Perto do minimo", variant: "warning" };
  }
  return { label: "OK", variant: "success" };
};

const getExpiryStatus = (
  item: StockItemRecord,
): { label: string; variant: "warning" | "error" | "info" } | null => {
  if (!item.data_validade) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(item.data_validade);
  expiry.setHours(0, 0, 0, 0);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / msPerDay);

  if (diffDays < 0) {
    return { label: "Vencido", variant: "error" };
  }

  if (diffDays <= 3) {
    return { label: `Vence em ${diffDays} dia(s)`, variant: "warning" };
  }

  if (diffDays <= 7) {
    return { label: `Validade em ${diffDays} dias`, variant: "info" };
  }

  return null;
};

export const StockPage = () => {
  const navigate = useNavigate();
  const groupId = useGroupStore((state) => state.groupId);
  const groupName = useGroupStore((state) => state.groupName);
  const userId = useAuthStore((state) => state.userId);
  const clearStock = useStockStore((state) => state.clearStock);
  const items = useStockStore((state) => state.items);
  const loading = useStockStore((state) => state.loading);
  const keepScreenOn = useStockStore((state) => state.keepScreenOn);
  const setKeepScreenOn = useStockStore((state) => state.setKeepScreenOn);
  const lastAutoAddedItemName = useStockStore((state) => state.lastAutoAddedItemName);
  const clearAutoAddedNotice = useStockStore((state) => state.clearAutoAddedNotice);
  const fetchItems = useStockStore((state) => state.fetchItems);
  const upsertItem = useStockStore((state) => state.upsertItem);
  const updateItemQuantity = useStockStore((state) => state.updateItemQuantity);
  const toggleInShoppingList = useStockStore((state) => state.toggleInShoppingList);
  const removeItem = useStockStore((state) => state.removeItem);

  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [search, setSearch] = useState("");
  const [showOnlySelected, setShowOnlySelected] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItemRecord | null>(null);
  const [historyItem, setHistoryItem] = useState<StockItemRecord | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState<StockImportSource>("auto");
  const [importing, setImporting] = useState(false);

  const wakeLock = useWakeLock();
  const { isSupported: wakeLockIsSupported, request: requestWakeLock, release: releaseWakeLock } = wakeLock;

  useEffect(() => {
    if (!groupId) return;
    const load = async (): Promise<void> => {
      try {
        await runAutoConsumption(groupId, userId);
      } catch {
        // Mantem fluxo resiliente mesmo se consumo automatico falhar.
      }

      try {
        await fetchItems(groupId);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar estoque");
      }
    };

    void load();
  }, [fetchItems, groupId, userId]);

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`stock-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "stock_items",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          void fetchItems(groupId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchItems, groupId]);

  useEffect(() => {
    if (!groupId) {
      clearStock();
    }
  }, [clearStock, groupId]);

  useEffect(() => {
    if (!wakeLockIsSupported) return;

    if (keepScreenOn) {
      void requestWakeLock();
    } else {
      void releaseWakeLock();
    }
  }, [keepScreenOn, wakeLockIsSupported, requestWakeLock, releaseWakeLock]);

  useEffect(() => {
    if (!lastAutoAddedItemName) return;

    const timeoutId = window.setTimeout(() => {
      clearAutoAddedNotice();
    }, 3000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clearAutoAddedNotice, lastAutoAddedItemName]);

  const categories = useMemo(() => {
    const dynamic = Array.from(new Set(items.map((item) => item.categoria))).sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );

    const known = categoryOrder.filter(
      (category) => category === "Todos" || dynamic.includes(category),
    );
    const extra = dynamic.filter((category) => !known.includes(category));
    return [...known, ...extra];
  }, [items]);

  const filteredItems = useMemo(() => {
    const byCategory =
      selectedCategory === "Todos"
        ? items
        : items.filter((item) => item.categoria === selectedCategory);

    const byListFlag = showOnlySelected ? byCategory.filter((item) => item.na_lista) : byCategory;

    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return byListFlag;

    return byListFlag.filter((item) => item.nome.toLowerCase().includes(normalizedSearch));
  }, [items, search, selectedCategory, showOnlySelected]);

  const itemNameSuggestions = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.nome.trim()).filter((name) => name.length > 0)),
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const importPreview = useMemo(() => {
    return parseStockImportText(importText, { source: importSource });
  }, [importSource, importText]);

  const handleSaveItem = async (payload: UpsertStockItemInput): Promise<void> => {
    setError(null);
    try {
      await upsertItem(payload);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Falha ao salvar item");
    }
  };

  const handleAdjustQuantity = async (item: StockItemRecord, sign: 1 | -1): Promise<void> => {
    setError(null);
    try {
      const delta = item.tamanho_porcao * sign;
      await updateItemQuantity(item.id, delta, userId);
    } catch (quantityError) {
      setError(
        quantityError instanceof Error ? quantityError.message : "Falha ao atualizar quantidade",
      );
    }
  };

  const handleToggleInList = async (item: StockItemRecord): Promise<void> => {
    setError(null);
    try {
      await toggleInShoppingList(item.id, !item.na_lista);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : "Falha ao atualizar lista de compras",
      );
    }
  };

  const handleDelete = async (itemId: string): Promise<void> => {
    setError(null);
    try {
      await removeItem(itemId);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Falha ao remover item");
    }
  };

  const handleImportFromText = async (): Promise<void> => {
    if (!groupId || importing) return;

    setError(null);
    const parsedItems = parseStockImportText(importText, { source: importSource });

    if (parsedItems.length === 0) {
      setError(
        "Nao consegui identificar itens validos no texto. Confira se ele contem nome e quantidade.",
      );
      return;
    }

    setImporting(true);

    try {
      const todayDate = new Date().toISOString().slice(0, 10);

      const existingByKey = new Map(
        items.map((item) => [
          `${item.nome.trim().toLowerCase()}::${item.unidade.toLowerCase()}`,
          item,
        ]),
      );

      const combinedByKey = new Map<
        string,
        { existing: StockItemRecord | undefined; totalQuantidade: number; parsed: ParsedStockImportItem }
      >();

      for (const parsed of parsedItems) {
        const key = `${parsed.nome.trim().toLowerCase()}::${parsed.unidade.toLowerCase()}`;
        const existing = existingByKey.get(key);
        const current = combinedByKey.get(key);
        combinedByKey.set(key, {
          existing: current?.existing ?? existing,
          totalQuantidade: (current?.totalQuantidade ?? existing?.quantidade ?? 0) + parsed.quantidade,
          parsed,
        });
      }

      await Promise.all(
        [...combinedByKey.values()].map(async ({ existing, totalQuantidade, parsed }) => {
          const payload: UpsertStockItemInput = {
            id: existing?.id,
            groupId,
            nome: parsed.nome,
            categoria: existing?.categoria ?? parsed.categoria,
            unidade: parsed.unidade,
            quantidade: totalQuantidade,
            quantidadeMinima: existing?.quantidade_minima ?? 0,
            tamanhoPorcao: existing?.tamanho_porcao ?? 1,
            autoAdicionarLista: existing?.auto_adicionar_lista ?? false,
            consumoFrequencia: existing?.consumo_frequencia ?? "weekly",
            consumoValor: existing?.consumo_valor ?? 0,
            dataCompra: todayDate,
            dataValidade: existing?.data_validade ?? null,
          };

          await upsertItem(payload);
        }),
      );

      setImportText("");
      setImportModalOpen(false);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Falha ao importar compra");
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    return (
      <main className="page auth">
        <h1>Carregando estoque</h1>
        <p>Buscando itens do grupo {groupName ?? "ativo"}...</p>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Estoque</h1>
          <p>{groupName ?? "Grupo ativo"}</p>
        </div>
        <div className="actions-row">
          <Button type="button" variant="ghost" onClick={() => setModalOpen(true)}>
            Novo item
          </Button>
          <Button type="button" variant="ghost" onClick={() => setImportModalOpen(true)}>
            Importar compra
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate("/list")}>
            Ir para lista
          </Button>
        </div>
      </header>

      {lastAutoAddedItemName && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success">
            <span>
              Item "{lastAutoAddedItemName}" adicionado automaticamente na lista de compras.
            </span>
          </div>
        </div>
      )}

      {error && <Alert type="error">{error}</Alert>}

      <Card className="card form">
        <CardBody>
          <div className="actions-row">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar item no estoque"
            />
            <label className="label cursor-pointer">
              <span className="label-text">Somente na lista</span>
              <input
                className="checkbox"
                type="checkbox"
                checked={showOnlySelected}
                onChange={(event) => setShowOnlySelected(event.target.checked)}
              />
            </label>
            {wakeLock.isSupported && (
              <label className="label cursor-pointer">
                <span className="label-text">Tela sempre ativa</span>
                <input
                  className="toggle"
                  type="checkbox"
                  checked={keepScreenOn}
                  onChange={(event) => setKeepScreenOn(event.target.checked)}
                />
              </label>
            )}
          </div>

          <div className="row categories-row">
            {categories.map((category) => (
              <Button
                key={category}
                type="button"
                variant={selectedCategory === category ? "primary" : "ghost"}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="stack-list mt-4">
        {filteredItems.length === 0 ? (
          <Card className="card">
            <CardBody>
              <p className="empty-state">Nenhum item encontrado para os filtros atuais.</p>
            </CardBody>
          </Card>
        ) : (
          filteredItems.map((item) => {
            const status = getStockStatus(item);
            const expiryStatus = getExpiryStatus(item);
            return (
              <Card key={item.id} className="card">
                <CardBody>
                  <div className="page-header">
                    <div>
                      <h3>{item.nome}</h3>
                      <p className="muted">
                        {item.quantidade.toFixed(2)} {item.unidade} · Min:{" "}
                        {item.quantidade_minima.toFixed(2)}
                      </p>
                    </div>
                    <div className="actions-row">
                      <Badge variant={status.variant}>{status.label}</Badge>
                      {expiryStatus && (
                        <Badge variant={expiryStatus.variant}>{expiryStatus.label}</Badge>
                      )}
                      {item.na_lista && <Badge variant="info">Na lista</Badge>}
                    </div>
                  </div>

                  <div className="actions-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleAdjustQuantity(item, -1)}
                    >
                      -{item.tamanho_porcao}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleAdjustQuantity(item, 1)}
                    >
                      +{item.tamanho_porcao}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => void handleToggleInList(item)}
                    >
                      {item.na_lista ? "Retirar da lista" : "Incluir na lista"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setEditingItem(item);
                        setModalOpen(true);
                      }}
                    >
                      Editar
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setHistoryItem(item)}>
                      Historico
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate(`/stock/item/${item.id}`)}
                    >
                      Detalhes e consumo
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="danger"
                      onClick={() => void handleDelete(item.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </CardBody>
              </Card>
            );
          })
        )}
      </div>

      {groupId && (
        <StockItemModal
          visible={modalOpen}
          groupId={groupId}
          nameSuggestions={itemNameSuggestions}
          onClose={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
          initialItem={editingItem}
          onSave={handleSaveItem}
        />
      )}

      <StockHistoryModal
        visible={Boolean(historyItem)}
        itemId={historyItem?.id ?? null}
        itemName={historyItem?.nome ?? ""}
        onClose={() => setHistoryItem(null)}
      />

      {importModalOpen && (
        <div
          className="modal-backdrop"
          onClick={() => setImportModalOpen(false)}
          role="presentation"
        >
          <div
            className="modal-card card"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modal-header">
              <h2>Importar compra por texto</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
              >
                Fechar
              </button>
            </div>

            <div className="form">
              <Textarea
                label="Cole o texto da compra"
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                rows={10}
                helperText="Aceita texto de comprovante, lista com 'X itens' e formato tabular com quantidade e preco."
              />

              <label className="label flex-col items-start gap-2">
                <span className="label-text text-base-content">Origem da compra</span>
                <select
                  className="select select-bordered w-full text-base-content"
                  value={importSource}
                  onChange={(event) => setImportSource(event.target.value as StockImportSource)}
                >
                  <option value="auto">Detectar automaticamente</option>
                  <option value="tenda">Tenda</option>
                  <option value="pague-menos">Pague Menos</option>
                </select>
              </label>

              <p className="muted">
                Itens detectados: {importPreview.length}
                {importPreview.length > 0
                  ? ` (${importPreview
                      .slice(0, 3)
                      .map((item) => item.nome)
                      .join(", ")}${importPreview.length > 3 ? ", ..." : ""})`
                  : ""}
              </p>

              <Button
                type="button"
                variant="primary"
                onClick={() => void handleImportFromText()}
                disabled={importing || importPreview.length === 0}
              >
                {importing ? "Importando..." : "Importar para estoque"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
