import type { ReactElement, ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Modal, ModalActions } from "../components/Modal/Modal";
import { Select } from "../components/Select/Select";
import { Textarea } from "../components/Textarea/Textarea";
import { Toast } from "../components/Toast/Toast";
import { parseShoppingImportText } from "../domain/shoppingImportParser";
import { type StockImportSource } from "../domain/stockImportParser";
import { ShoppingListView } from "../features/inventory/components/shoppingListView/ShoppingListView";
import type { InventoryProduct, InventoryShoppingListItem } from "../features/inventory/types";
import {
  addListItem,
  deleteListItem,
  ensureActiveListForGroup,
  finishShoppingList,
  loadListItems,
  toggleListItemPurchased,
  updateListItemPrice,
  updateListItemQuantity,
  type ItemRecord,
} from "../lib/webData";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";
import { useStockStore } from "../stores/stockStore";
import type { StockItemRecord } from "../lib/webData";
import type { Unit } from "../types/inventory.types";
import { toUnit } from "../types/inventory.types";

/**
 * Shopping List Page with integrated inventory feature using latest UX.
 * Shows shopping items with smart input parser and real-time editing.
 */
export const ListPageNew = (): ReactElement => {
  const navigate = useNavigate();
  const groupId = useGroupStore((state) => state.groupId);
  const listId = useGroupStore((state) => state.listId);
  const setListId = useGroupStore((state) => state.setListId);
  const userId = useAuthStore((state) => state.userId);

  const stockItems = useStockStore((state) => state.items);

  const [shoppingItems, setShoppingItems] = useState<ItemRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState<StockImportSource>("auto");
  const [importing, setImporting] = useState(false);

  const parseListQuantity = useCallback((rawQuantity: string): { quantity: number; unit: Unit } => {
    const normalized = rawQuantity.trim().replace(/\s+/g, " ");
    const match = normalized.match(/^(\d+(?:[.,]\d+)?)(?:\s+([a-zA-Z]+))?$/);

    if (!match) {
      return { quantity: 1, unit: "Un" };
    }

    const parsedQuantity = Number.parseFloat(match[1].replace(",", "."));

    return {
      quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1,
      unit: toUnit(match[2]),
    };
  }, []);

  const isPriceOlderThan30Days = useCallback((createdAt: string | null): boolean => {
    if (!createdAt) return false;

    const createdTime = new Date(createdAt).getTime();
    if (Number.isNaN(createdTime)) return false;

    const diffMs = Date.now() - createdTime;
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    return diffMs > thirtyDaysMs;
  }, []);

  const refreshItems = useCallback(async (targetListId?: string | null): Promise<void> => {
    if (!targetListId) {
      setShoppingItems([]);
      return;
    }

    const loadedItems = await loadListItems(targetListId);
    setShoppingItems(loadedItems);
  }, []);

  useEffect(() => {
    if (!groupId) {
      navigate("/group");
    }
  }, [groupId, navigate]);

  useEffect(() => {
    if (!groupId) return;

    let mounted = true;

    const loadData = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const activeListId = (await ensureActiveListForGroup(groupId)).id;
        if (!mounted) return;

        if (listId !== activeListId) {
          setListId(activeListId);
        }

        await refreshItems(activeListId);
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : "Falha ao carregar lista");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, [groupId, listId, refreshItems, setListId]);

  useEffect(() => {
    if (!listId || !groupId) return;

    const channel = supabase
      .channel(`list-new-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "items",
          filter: `list_id=eq.${listId}`,
        },
        () => {
          void refreshItems(listId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, listId, refreshItems]);

  const stockProducts = useMemo(
    () =>
      stockItems.map(
        (item: StockItemRecord): InventoryProduct => ({
          id: item.id,
          name: item.nome,
          quantity: item.quantidade,
          minStock: item.quantidade_minima,
          unit: item.unidade || "Un",
          categoryId: item.categoria || "Outros",
          validityDate: (item as unknown as { validade_em?: string | null }).validade_em || null,
          needsValidity: false,
        }),
      ),
    [stockItems],
  );

  const shoppingList = useMemo<InventoryShoppingListItem[]>(
    () =>
      shoppingItems.map((item) => {
        const parsed = parseListQuantity(item.quantidade);

        return {
          id: item.id,
          productId: `list-${item.id}`,
          quantity: parsed.quantity,
          checked: item.comprado,
          price: item.preco,
          isPriceStale: item.preco !== null && isPriceOlderThan30Days(item.criado_em),
        };
      }),
    [isPriceOlderThan30Days, parseListQuantity, shoppingItems],
  );

  const shoppingProducts = useMemo<InventoryProduct[]>(
    () =>
      shoppingItems.map((item) => {
        const parsed = parseListQuantity(item.quantidade);

        return {
          id: `list-${item.id}`,
          name: item.nome,
          quantity: parsed.quantity,
          minStock: 0,
          unit: parsed.unit,
          categoryId: item.categoria || "Outros",
          validityDate: null,
          needsValidity: false,
        };
      }),
    [parseListQuantity, shoppingItems],
  );

  const products = useMemo<InventoryProduct[]>(() => {
    const merged = [...stockProducts];
    const knownIds = new Set(merged.map((product) => product.id));

    for (const shoppingProduct of shoppingProducts) {
      if (!knownIds.has(shoppingProduct.id)) {
        merged.push(shoppingProduct);
      }
    }

    return merged;
  }, [shoppingProducts, stockProducts]);

  const handleSmartAdd = useCallback(
    async (payload: {
      name: string;
      quantity: number;
      unit: string;
      price: number | null;
      hasQuantity: boolean;
      category: string;
    }): Promise<void> => {
      if (!listId) {
        setError("Lista não inicializada");
        return;
      }

      const itemName = payload.name.trim();
      if (!itemName) {
        return;
      }

      const matchedStockItem = stockItems.find(
        (item) => item.nome.trim().toLowerCase() === itemName.toLowerCase(),
      );
      const quantityLabel = `${payload.quantity} ${payload.unit}`;

      setSaving(true);
      setError(null);

      try {
        await addListItem({
          listId,
          nome: itemName,
          quantidade: quantityLabel,
          categoria: payload.category || matchedStockItem?.categoria || "Outros",
          price: payload.price,
          createdBy: userId,
        });
        await refreshItems(listId);
        setNotice(`"${itemName}" adicionado na lista.`);
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "Falha ao adicionar item");
      } finally {
        setSaving(false);
      }
    },
    [listId, refreshItems, stockItems, userId],
  );

  const handleToggleItemChecked = useCallback(
    async (itemId: string): Promise<void> => {
      const targetItem = shoppingItems.find((item) => item.id === itemId);
      if (!targetItem || !listId) return;

      setError(null);

      try {
        await toggleListItemPurchased(itemId, !targetItem.comprado);
        await refreshItems(listId);
      } catch (toggleError) {
        setError(toggleError instanceof Error ? toggleError.message : "Falha ao atualizar item");
      }
    },
    [listId, refreshItems, shoppingItems],
  );

  const handleRemoveItem = useCallback(
    async (itemId: string): Promise<void> => {
      if (!listId) return;

      setError(null);

      try {
        await deleteListItem(itemId);
        await refreshItems(listId);
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Falha ao remover item");
      }
    },
    [listId, refreshItems],
  );

  const handleUpdateItemQuantity = useCallback(
    async (itemId: string, quantity: number): Promise<void> => {
      if (!listId) return;

      const item = shoppingItems.find((i) => i.id === itemId);
      if (!item) return;

      const parsed = parseListQuantity(item.quantidade);
      const unit = parsed.unit || "Un";
      const quantityLabel = `${quantity} ${unit}`;

      try {
        await updateListItemQuantity(itemId, quantityLabel);
        await refreshItems(listId);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Falha ao atualizar quantidade");
      }
    },
    [listId, parseListQuantity, refreshItems, shoppingItems],
  );

  const handleGenerateSmartList = useCallback(async (): Promise<void> => {
    if (!listId) return;

    const listKeys = new Set(
      shoppingItems.map((item) => {
        const parsed = parseListQuantity(item.quantidade);
        return `${item.nome.trim().toLowerCase()}::${parsed.unit.toLowerCase()}`;
      }),
    );

    const candidates = stockItems.filter((item) => item.quantidade <= item.quantidade_minima);
    const missingItems = candidates.filter((item) => {
      const key = `${item.nome.trim().toLowerCase()}::${(item.unidade || "un").toLowerCase()}`;
      return !listKeys.has(key);
    });

    if (missingItems.length === 0) {
      setNotice("Lista inteligente já está atualizada.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await Promise.all(
        missingItems.map((item) => {
          const neededQuantity = Math.max(item.quantidade_minima - item.quantidade, 1);

          return addListItem({
            listId,
            nome: item.nome,
            quantidade: `${neededQuantity} ${item.unidade || "un"}`,
            categoria: item.categoria || "Outros",
            createdBy: userId,
          });
        }),
      );

      await refreshItems(listId);
      setNotice(`${missingItems.length} item(ns) adicionado(s) pela lista inteligente.`);
    } catch (smartError) {
      setError(
        smartError instanceof Error ? smartError.message : "Falha ao gerar lista inteligente",
      );
    } finally {
      setSaving(false);
    }
  }, [listId, parseListQuantity, refreshItems, shoppingItems, stockItems, userId]);

  const handleUpdateItemPrice = useCallback(
    async (itemId: string, value: number | null): Promise<void> => {
      if (!listId) return;

      setError(null);

      try {
        await updateListItemPrice(itemId, value);
        await refreshItems(listId);
      } catch (priceError) {
        setError(priceError instanceof Error ? priceError.message : "Falha ao atualizar preço");
      }
    },
    [listId, refreshItems],
  );

  const importPreview = useMemo(() => {
    return parseShoppingImportText(importText, { source: importSource });
  }, [importSource, importText]);

  const handleImportToList = async (): Promise<void> => {
    if (!listId || importing) return;

    setError(null);
    const parsedItems = parseShoppingImportText(importText, { source: importSource });

    if (parsedItems.length === 0) {
      setError("Não consegui identificar itens válidos no texto para importar na lista.");
      return;
    }

    setImporting(true);
    try {
      for (const item of parsedItems) {
        await addListItem({
          listId,
          nome: item.nome,
          quantidade: item.quantidade,
          categoria: item.categoria,
          price: item.preco,
          createdBy: userId,
        });
      }

      await refreshItems(listId);
      setImportText("");
      setImportModalOpen(false);
      setNotice(`${parsedItems.length} item(ns) importado(s) com sucesso.`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Falha ao importar compra");
    } finally {
      setImporting(false);
    }
  };

  const handleFinalizeShopping = useCallback(async (): Promise<void> => {
    if (!listId || !groupId || shoppingItems.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nextListId = await finishShoppingList(listId, groupId);
      if (nextListId) {
        setListId(nextListId);
      }
      await refreshItems(nextListId);
      setNotice("Compra finalizada. Itens pendentes reaproveitados na nova lista.");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Falha ao finalizar compra");
    } finally {
      setSaving(false);
    }
  }, [groupId, listId, refreshItems, setListId, shoppingItems.length]);

  if (!groupId) {
    return <Alert type="warning">Selecione um grupo para continuar</Alert>;
  }

  if (loading) {
    return <Alert type="info">Carregando lista de compras...</Alert>;
  }

  const checkedCount = shoppingList.filter((item) => item.checked).length;
  const uncheckedCount = shoppingList.filter((item) => !item.checked).length;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Toast visible={!!notice} onDismiss={() => setNotice(null)} testId="list-feedback-toast">
        {notice}
      </Toast>

      {error && <Alert type="error">{error}</Alert>}

      <div className="flex-1 overflow-y-auto pb-20">
        <ShoppingListView
          products={products}
          shoppingList={shoppingList}
          checkedCount={checkedCount}
          uncheckedCount={uncheckedCount}
          finalizing={saving}
          finalizeDisabled={saving || shoppingItems.length === 0}
          onSmartAdd={handleSmartAdd}
          onToggle={handleToggleItemChecked}
          onRemove={handleRemoveItem}
          onGenerateSmartList={handleGenerateSmartList}
          onFinalizeShopping={handleFinalizeShopping}
          onUpdateItemPrice={(id, value) => void handleUpdateItemPrice(id, value)}
          onUpdateItemQuantity={(id, value) => void handleUpdateItemQuantity(id, value)}
          onOpenImportModal={() => setImportModalOpen(true)}
          onViewHistory={() => navigate("/history")}
        />
      </div>

      {importModalOpen && (
        <Modal
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Importar compra para lista"
        >
          <div className="space-y-4">
            <Textarea
              label="Cole o texto da compra"
              value={importText}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setImportText(event.target.value)
              }
              rows={10}
              placeholder="Cole o recibo da compra aqui..."
              helperText="Importa nome, quantidade e preço total por item quando disponível."
            />

            <Select
              label="Origem da compra"
              value={importSource}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setImportSource(event.target.value as StockImportSource)
              }
              options={[
                { value: "auto", label: "Detectar automaticamente" },
                { value: "tenda", label: "Tenda" },
                { value: "pague-menos", label: "Pague Menos" },
              ]}
            />

            <p className="text-xs text-base-content/60">
              Itens detectados: {importPreview.length}
              {importPreview.length > 0
                ? ` (${importPreview
                    .slice(0, 3)
                    .map((item) => item.nome)
                    .join(", ")}${importPreview.length > 3 ? ", ..." : ""})`
                : ""}
            </p>

            <ModalActions>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleImportToList()}
                disabled={importing || importPreview.length === 0}
              >
                {importing ? "Importando..." : "Importar"}
              </Button>
            </ModalActions>
          </div>
        </Modal>
      )}
    </div>
  );
};
