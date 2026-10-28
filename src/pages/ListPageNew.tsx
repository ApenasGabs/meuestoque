import type { ReactElement, ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Drawer } from "../components/Drawer/Drawer";
import { Select } from "../components/Select/Select";
import { Textarea } from "../components/Textarea/Textarea";
import { Toast } from "../components/Toast/Toast";
import { parseShoppingImportText } from "../domain/shoppingImportParser";
import { type StockImportSource } from "../domain/stockImportParser";
import { ShoppingListView } from "../features/inventory/components/shoppingListView/ShoppingListView";
import type { InventoryProduct, InventoryShoppingListItem } from "../features/inventory/types";
import {
  addListItem,
  applyReceiptMatchToListItem,
  deleteListItem,
  deleteListItemsBulk,
  ensureActiveListForGroup,
  finishShoppingList,
  loadListItems,
  toggleListItemPurchased,
  updateListItemName,
  updateListItemPrice,
  updateListItemUnitPrice,
  updateListItemQuantity,
  updateListItemValidityDate,
  updateListItemPackSize,
  type ItemRecord,
} from "../lib/webData";
import { supabase } from "../lib/supabase";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";
import { useStockStore } from "../stores/stockStore";
import type { StockItemRecord } from "../lib/webData";
import type { Unit } from "../types/inventory.types";
import { toUnit } from "../types/inventory.types";
import { resolveProductByEan, saveEanMapping } from "../lib/barcodeService";
import { BarcodeScannerModal } from "../components/Scanner/BarcodeScannerModal";
import { TendaPriceDrawer } from "../components/TendaPriceDrawer/TendaPriceDrawer";
import { NfceScannerModal } from "../components/Scanner/NfceScannerModal";
import {
  NfceReviewDrawer,
  type NfceFinalizePayload,
} from "../components/NfceReviewDrawer/NfceReviewDrawer";
import { fetchNfceData } from "../services/nfceService";
import { formatIsoDateToPtBr, type NfceParsedDocument } from "../domain/nfceParser";
import { recordNfcePriceHistory } from "../services/priceHistoryService";
import {
  matchReceiptWithShoppingList,
  type MatchReceiptResult,
} from "../domain/receiptMatcher";

/**
 * Main shopping list page with integrated inventory intelligence.
 *
 * Features:
 * - Real-time sync with Supabase and optimistic UI updates
 * - Smart item parser supporting "Name, Qty, Price" format
 * - Automatic "Smart List" generation based on inventory minimum stock levels
 * - Receipt/Text import engine with automatic detection
 * - Unit and currency conversion (Total vs Unit price)
 * - Expiry date collection during shopping checkout
 * - Persistent active list management per group
 */
export const ListPageNew = (): ReactElement => {
  const navigate = useNavigate();
  const groupId = useGroupStore((state) => state.groupId);
  const listId = useGroupStore((state) => state.listId);
  const setListId = useGroupStore((state) => state.setListId);
  const userId = useAuthStore((state) => state.userId);

  const stockItems = useStockStore((state) => state.items);
  const fetchStockItems = useStockStore((state) => state.fetchItems);

  const [shoppingItems, setShoppingItems] = useState<ItemRecord[]>([]);
  const shoppingItemsRef = useRef(shoppingItems);
  shoppingItemsRef.current = shoppingItems;

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importSource, setImportSource] = useState<StockImportSource>("auto");
  const [importing, setImporting] = useState(false);

  const [scannerOpen, setScannerOpen] = useState(false);
  const [pendingEan, setPendingEan] = useState<string | null>(null);
  const [smartInput, setSmartInput] = useState<string>("");
  const [tendaDrawerOpen, setTendaDrawerOpen] = useState<boolean>(false);
  const [nfceScannerOpen, setNfceScannerOpen] = useState<boolean>(false);
  const [nfceReviewOpen, setNfceReviewOpen] = useState<boolean>(false);
  const [nfceParsedDoc, setNfceParsedDoc] = useState<NfceParsedDocument | null>(null);
  const [nfceMatchResult, setNfceMatchResult] = useState<MatchReceiptResult | null>(null);
  const [nfceProcessing, setNfceProcessing] = useState<boolean>(false);
  const [nfceAppliedReceipt, setNfceAppliedReceipt] = useState<{
    marketName: string;
    purchaseDate: string;
  } | null>(null);
  const canUseCamera = typeof window !== "undefined" && window.isSecureContext;

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
          pricePerUnit: item.preco_unitario,
          totalPrice: item.preco_total,
          validityDate: item.data_validade,
          naoAplicaValidade: item.nao_aplica_validade,
          packLabel: item.pack_label ?? null,
          packSize: item.pack_size ?? null,
          packUnit: item.pack_unit ?? null,
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
      packSize?: number | null;
      packUnit?: string | null;
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
          packSize: payload.packSize ?? null,
          packUnit: payload.packUnit ?? null,
          packLabel: payload.packSize ? "pacote" : null,
        });

        if (pendingEan && groupId) {
          await saveEanMapping(groupId, pendingEan, itemName, payload.unit, payload.category);
          setPendingEan(null);
        }

        await refreshItems(listId);
        setNotice(`"${itemName}" adicionado na lista.`);
      } catch (addError) {
        setError(addError instanceof Error ? addError.message : "Falha ao adicionar item");
      } finally {
        setSaving(false);
      }
    },
    [listId, refreshItems, stockItems, userId, pendingEan, groupId],
  );

  const handleToggleItemChecked = useCallback(
    async (itemId: string): Promise<void> => {
      const currentItems = shoppingItemsRef.current;
      const targetItem = currentItems.find((item) => item.id === itemId);
      if (!targetItem || !listId) return;

      const newPurchasedState = !targetItem.comprado;

      // Optimistic update — flip the checked state locally before awaiting the network.
      setShoppingItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, comprado: newPurchasedState } : item)),
      );

      setError(null);

      try {
        await toggleListItemPurchased(itemId, newPurchasedState);
        // No need to refreshItems — the Supabase real-time channel will sync.
      } catch (toggleError) {
        // Rollback optimistic update on failure.
        setShoppingItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, comprado: targetItem.comprado } : item,
          ),
        );
        setError(toggleError instanceof Error ? toggleError.message : "Falha ao atualizar item");
      }
    },
    [listId],
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

      const item = shoppingItemsRef.current.find((i) => i.id === itemId);
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
    [listId, parseListQuantity, refreshItems],
  );

  const handleUpdateItemUnit = useCallback(
    async (itemId: string, unit: Unit): Promise<void> => {
      if (!listId) return;

      const item = shoppingItemsRef.current.find((i) => i.id === itemId);
      if (!item) return;

      const parsed = parseListQuantity(item.quantidade);
      const quantity = parsed.quantity || 1;
      const quantityLabel = `${quantity} ${unit}`;

      try {
        await updateListItemQuantity(itemId, quantityLabel);
        await refreshItems(listId);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Falha ao atualizar unidade");
      }
    },
    [listId, parseListQuantity, refreshItems],
  );

  const handleUpdateItemName = useCallback(
    async (itemId: string, newName: string): Promise<void> => {
      if (!listId) return;

      const trimmed = newName.trim();
      if (!trimmed) return;

      const currentItem = shoppingItemsRef.current.find((i) => i.id === itemId);
      if (!currentItem || currentItem.nome === trimmed) return;

      setShoppingItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, nome: trimmed } : item)),
      );
      setError(null);

      try {
        await updateListItemName(itemId, trimmed);
        setNotice(`Item renomeado para "${trimmed}".`);
      } catch (updateError) {
        setShoppingItems((prev) =>
          prev.map((item) => (item.id === itemId ? { ...item, nome: currentItem.nome } : item)),
        );
        if (listId) {
          await refreshItems(listId);
        }
        setError(
          updateError instanceof Error
            ? updateError.message
            : "Falha ao atualizar nome do item",
        );
      }
    },
    [listId, refreshItems],
  );

  const handleGenerateSmartList = useCallback(async (): Promise<void> => {
    if (!listId) return;

    const listKeys = new Set(
      shoppingItemsRef.current.map((item) => {
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
  }, [listId, parseListQuantity, refreshItems, stockItems, userId]);

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

  const handleUpdateItemUnitPrice = useCallback(
    async (itemId: string, unitPrice: number | null): Promise<void> => {
      if (!listId) return;

      const item = shoppingItemsRef.current.find((i) => i.id === itemId);
      if (!item) return;

      const parsed = parseListQuantity(item.quantidade);
      setError(null);

      try {
        await updateListItemUnitPrice(itemId, unitPrice, parsed.quantity);
        await refreshItems(listId);
      } catch (priceError) {
        setError(priceError instanceof Error ? priceError.message : "Falha ao atualizar preço");
      }
    },
    [listId, parseListQuantity, refreshItems],
  );

  const fireUpdateItemPrice = useCallback(
    (id: string, value: number | null): void => {
      void handleUpdateItemPrice(id, value);
    },
    [handleUpdateItemPrice],
  );

  const fireUpdateItemUnitPrice = useCallback(
    (id: string, value: number | null): void => {
      void handleUpdateItemUnitPrice(id, value);
    },
    [handleUpdateItemUnitPrice],
  );

  const fireUpdateItemQuantity = useCallback(
    (id: string, value: number): void => {
      void handleUpdateItemQuantity(id, value);
    },
    [handleUpdateItemQuantity],
  );

  const fireUpdateItemUnit = useCallback(
    (id: string, value: Unit): void => {
      void handleUpdateItemUnit(id, value);
    },
    [handleUpdateItemUnit],
  );

  const handleUpdateValidityDate = useCallback(
    async (
      itemId: string,
      validityDate: string | null,
      naoAplicaValidade?: boolean,
    ): Promise<void> => {
      if (!listId) return;

      setError(null);
      try {
        await updateListItemValidityDate(itemId, validityDate, naoAplicaValidade);
        await refreshItems(listId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao atualizar validade");
      }
    },
    [listId, refreshItems],
  );

  const fireUpdateValidityDate = useCallback(
    (id: string, date: string | null, naoAplica?: boolean): void => {
      void handleUpdateValidityDate(id, date, naoAplica);
    },
    [handleUpdateValidityDate],
  );

  const handleUpdatePackSize = useCallback(
    async (
      itemId: string,
      packLabel: string | null,
      packSize: number | null,
      packUnit: string | null,
    ): Promise<void> => {
      if (!listId) return;

      // Optimistic update
      setShoppingItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? { ...item, pack_label: packLabel, pack_size: packSize, pack_unit: packUnit }
            : item,
        ),
      );

      try {
        await updateListItemPackSize(itemId, packLabel, packSize, packUnit);
      } catch (err) {
        // Rollback on error
        await refreshItems(listId);
        setError(err instanceof Error ? err.message : "Falha ao atualizar embalagem");
      }
    },
    [listId, refreshItems],
  );

  const fireUpdatePackSize = useCallback(
    (
      id: string,
      packLabel: string | null,
      packSize: number | null,
      packUnit: string | null,
    ): void => {
      void handleUpdatePackSize(id, packLabel, packSize, packUnit);
    },
    [handleUpdatePackSize],
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
    if (!listId || !groupId || shoppingItemsRef.current.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const nextListId = await finishShoppingList(
        listId,
        groupId,
        nfceAppliedReceipt?.purchaseDate,
      );
      if (nextListId) {
        setListId(nextListId);
      }
      setNfceAppliedReceipt(null);
      await Promise.all([refreshItems(nextListId), fetchStockItems(groupId)]);
      setNotice("Compra finalizada e registrada no histórico e no estoque.");
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "Falha ao finalizar compra");
    } finally {
      setSaving(false);
    }
  }, [fetchStockItems, groupId, listId, nfceAppliedReceipt, refreshItems, setListId]);

  const handleBarcodeScan = useCallback(
    async (ean: string) => {
      if (!groupId) return;
      setScannerOpen(false);
      setLoading(true);

      try {
        const result = await resolveProductByEan(ean, groupId);

        if (result.found && result.name) {
          // Limpa EAN pendente anterior (se houver) para não associar ao produto errado
          setPendingEan(null);
          // Atualiza o input diretamente sem precisar do workaround do queueMicrotask
          setSmartInput(`${result.name}, 1`);
          setNotice(`📸 ${result.name}`);
        } else {
          // Produto desconhecido — guarda o EAN para salvar depois
          setPendingEan(ean);
          setNotice("Código não reconhecido. Digite o nome para o sistema aprender!");
        }
      } catch {
        setError("Erro ao processar o código de barras.");
      } finally {
        setLoading(false);
      }
    },
    [groupId],
  );

  const quoteItems = useMemo(() => {
    return shoppingItems.map((item) => {
      const parsed = parseListQuantity(item.quantidade);
      return {
        id: item.id,
        name: item.nome,
        quantity: parsed.quantity,
        unit: parsed.unit,
        currentPrice: item.preco ?? null,
      };
    });
  }, [parseListQuantity, shoppingItems]);

  const handleApplyTendaPrice = useCallback(
    (itemId: string, price: number, newName?: string): void => {
      if (newName) {
        setShoppingItems((prev) =>
          prev.map((item) =>
            item.id === itemId ? { ...item, nome: newName, preco: price } : item,
          ),
        );
        void (async () => {
          try {
            await updateListItemName(itemId, newName);
            fireUpdateItemUnitPrice(itemId, price);
            setNotice(`Marca trocada para "${newName}" e preço atualizado!`);
          } catch (err) {
            if (listId) {
              await refreshItems(listId);
            }
            setError(err instanceof Error ? err.message : "Falha ao trocar marca na lista");
          }
        })();
      } else {
        fireUpdateItemUnitPrice(itemId, price);
        setNotice("Preço atualizado com a cotação do Tenda!");
      }
    },
    [fireUpdateItemUnitPrice, listId, refreshItems],
  );

  const handleApplyAllTendaPrices = useCallback(
    (updates: { itemId: string; price: number }[]): void => {
      for (const update of updates) {
        fireUpdateItemUnitPrice(update.itemId, update.price);
      }
      setNotice(`${updates.length} preço(s) atualizado(s) com a cotação do Tenda!`);
    },
    [fireUpdateItemUnitPrice],
  );

  const handleNfceScanUrl = useCallback(
    async (urlOrChave: string): Promise<void> => {
      setLoading(true);
      setError(null);
      setNotice("Consultando nota fiscal na SEFAZ...");

      try {
        const doc = await fetchNfceData(urlOrChave);
        const match = matchReceiptWithShoppingList(doc.itens, shoppingList, products);

        setNfceParsedDoc(doc);
        setNfceMatchResult(match);
        setNfceReviewOpen(true);
        setNotice(`Nota fiscal de ${doc.emitente} carregada com sucesso!`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao consultar nota fiscal");
      } finally {
        setLoading(false);
      }
    },
    [products, shoppingList],
  );

  const handleConfirmNfceFinalize = useCallback(
    async (payload: NfceFinalizePayload): Promise<void> => {
      if (!listId || !groupId) return;

      setNfceProcessing(true);
      setError(null);

      try {
        await Promise.all(
          payload.matchedItemsToUpdate.map((item) =>
            applyReceiptMatchToListItem({
              itemId: item.listItemId,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              validityDate: item.validityDate,
              naoAplicaValidade: item.naoAplicaValidade,
            }),
          ),
        );

        await Promise.all(
          payload.newItemsToAdd.map((newItem) =>
            addListItem({
              listId,
              nome: newItem.name,
              quantidade: `${newItem.quantity} ${newItem.unit}`,
              categoria: "Outros",
              price: newItem.totalPrice,
              precoUnitario: newItem.unitPrice,
              precoTotal: newItem.totalPrice,
              comprado: true,
              createdBy: userId,
            }),
          ),
        );

        const priceEntries = [
          ...payload.matchedItemsToUpdate.map((item) => ({
            productName: item.receiptName,
            baseProductHint: item.listItemName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            unit: item.unit,
          })),
          ...payload.newItemsToAdd.map((newItem) => ({
            productName: newItem.name,
            unitPrice: newItem.unitPrice,
            quantity: newItem.quantity,
            unit: newItem.unit,
          })),
        ];

        await recordNfcePriceHistory(
          priceEntries,
          payload.marketName,
          payload.purchaseDate,
        );

        await refreshItems(listId);

        setNfceAppliedReceipt({
          marketName: payload.marketName,
          purchaseDate: payload.purchaseDate,
        });
        setNfceReviewOpen(false);
        setNotice(
          `Nota fiscal de ${payload.marketName} aplicada na lista! Revise os itens e clique em "Finalizar compra".`,
        );
      } catch (err) {
        await refreshItems(listId);
        setError(err instanceof Error ? err.message : "Erro ao aplicar nota fiscal na lista");
      } finally {
        setNfceProcessing(false);
      }
    },
    [groupId, listId, refreshItems, userId],
  );

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

      {nfceAppliedReceipt && (
        <div
          data-testid="nfce-applied-banner"
          className="mx-auto w-full max-w-6xl px-4 pt-4 md:px-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-success/40 bg-success/10 p-4">
            <div>
              <p className="text-sm font-bold text-base-content">
                Nota fiscal aplicada na lista: {nfceAppliedReceipt.marketName} (
                {formatIsoDateToPtBr(nfceAppliedReceipt.purchaseDate)})
              </p>
              <p className="text-xs text-base-content/70 mt-0.5">
                Os preços e quantidades foram preenchidos e os itens marcados como comprados. Revise ou ajuste validades e finalize a compra.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={saving || shoppingItems.length === 0}
                onClick={() => void handleFinalizeShopping()}
                data-testid="nfce-banner-finalize-button"
              >
                {saving ? "Finalizando..." : "Finalizar compra agora"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto ${checkedCount > 0 ? "pb-40" : "pb-28"}`}>
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
          onUpdateItemPrice={fireUpdateItemPrice}
          onUpdateItemUnitPrice={fireUpdateItemUnitPrice}
          onUpdateItemQuantity={fireUpdateItemQuantity}
          onUpdateItemUnit={fireUpdateItemUnit}
          onUpdateItemName={handleUpdateItemName}
          onUpdateValidityDate={fireUpdateValidityDate}
          onUpdatePackSize={fireUpdatePackSize}
          onBulkRemove={async (itemIds: string[]) => {
            try {
              await deleteListItemsBulk(itemIds);
              setNotice(`${itemIds.length} item(ns) removido(s).`);
              if (listId) await refreshItems(listId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Falha ao remover itens");
            }
          }}
          onBulkUpdateValidity={async (itemIds, validityDate, naoAplica) => {
            // Shopping list items use the per-item RPC since there is no
            // bulk RPC for the items table; the list is small enough that
            // sequential updates are acceptable.
            for (const id of itemIds) {
              await updateListItemValidityDate(id, naoAplica ? null : validityDate, naoAplica);
            }
            if (listId) await refreshItems(listId);
            setNotice(`${itemIds.length} item(ns) atualizado(s).`);
          }}
          onOpenTendaQuotes={() => setTendaDrawerOpen(true)}
          onOpenImportModal={() => setImportModalOpen(true)}
          onOpenNfceScan={() => setNfceScannerOpen(true)}
          onViewHistory={() => navigate("/history")}
          canUseScanner={canUseCamera}
          onScannerOpen={() => setScannerOpen(true)}
          smartInput={smartInput}
          onSmartInputChange={setSmartInput}
        />
      </div>

      {importModalOpen && (
        <Drawer
          open={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          title="Importar compra"
          subtitle="Cole o texto do recibo para adicionar itens rapidamente"
        >
          <div className="space-y-4">
            <Textarea
              label="Texto da compra"
              value={importText}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                setImportText(event.target.value)
              }
              rows={8}
              placeholder="Ex: 2kg arroz, feijão 1kg..."
              helperText="Detecta automaticamente nome, quantidade e preço."
              className="text-sm"
            />

            <Select
              label="Origem (opcional)"
              value={importSource}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setImportSource(event.target.value as StockImportSource)
              }
              options={[
                { value: "auto", label: "Auto-detectar" },
                { value: "tenda", label: "Tenda" },
                { value: "pague-menos", label: "Pague Menos" },
              ]}
              size="sm"
            />

            <div className="bg-base-200/50 p-3 rounded-lg border border-base-300">
              <p className="text-xs font-bold uppercase text-base-content/40 mb-2">
                Prévia da importação
              </p>
              <p className="text-sm font-medium">
                {importPreview.length > 0
                  ? `${importPreview.length} itens encontrados`
                  : "Nenhum item detectado ainda"}
              </p>
              {importPreview.length > 0 && (
                <p className="text-[10px] text-base-content/60 mt-1 line-clamp-2">
                  {importPreview.map((item) => item.nome).join(", ")}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setImportModalOpen(false)}
                disabled={importing}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => void handleImportToList()}
                disabled={importing || importPreview.length === 0}
              >
                {importing ? "Importando..." : "Importar"}
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {scannerOpen && (
        <BarcodeScannerModal
          open={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onScan={handleBarcodeScan}
        />
      )}

      <TendaPriceDrawer
        open={tendaDrawerOpen}
        onClose={() => setTendaDrawerOpen(false)}
        items={quoteItems}
        defaultCep="13064-789"
        onApplyPrice={handleApplyTendaPrice}
        onApplyAllPrices={handleApplyAllTendaPrices}
      />

      {nfceScannerOpen && (
        <NfceScannerModal
          open={nfceScannerOpen}
          onClose={() => setNfceScannerOpen(false)}
          onScanUrl={(urlOrChave) => void handleNfceScanUrl(urlOrChave)}
        />
      )}

      {nfceReviewOpen && (
        <NfceReviewDrawer
          open={nfceReviewOpen}
          onClose={() => setNfceReviewOpen(false)}
          parsedDoc={nfceParsedDoc}
          matchResult={nfceMatchResult}
          onConfirmFinalize={handleConfirmNfceFinalize}
          loading={nfceProcessing}
        />
      )}
    </div>
  );
};
