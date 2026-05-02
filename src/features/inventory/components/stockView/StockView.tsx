import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Button } from "../../../../components/Button/Button";
import { Drawer } from "../../../../components/Drawer/Drawer";
import { Input } from "../../../../components/Input/Input";
import type { InventoryCategory, InventoryProduct, StockFilter } from "../../types";
import { CategorySection } from "../categorySection/CategorySection";
import { ConsumptionHistoryDrawer } from "../consumptionHistory/ConsumptionHistoryDrawer";
import { ProductFormModal } from "../productFormModal/ProductFormModal";
import { useBulkStore } from "../../../../stores/bulkStore";
import { XOutlined } from "@ant-design/icons";

interface StockViewProps {
  products: InventoryProduct[];
  categories: InventoryCategory[];
  search: string;
  filters: StockFilter[];
  onSearchChange: (value: string) => void;
  onToggleFilter: (value: StockFilter) => void;
  onClearFilters: () => void;
  onAddProduct: (product: Omit<InventoryProduct, "id">) => void;
  onUpdateProduct: (id: string, product: Omit<InventoryProduct, "id">) => void;
  onRemoveProduct: (id: string) => void;
  onConsumeProduct?: (product: InventoryProduct, portions?: number) => void;
  onAddToShoppingList: (product: InventoryProduct) => void;
  onAddCategory: (name: string) => string;
  onBulkUpdateValidity?: (
    itemIds: string[],
    validityDate: string | null,
    naoAplica: boolean,
  ) => Promise<void>;
}

/**
 * Main container for the Inventory/Stock feature.
 *
 * Features:
 * - Real-time product search and status filtering (All, Low, Out)
 * - Categorized product display with expandable sections
 * - "Pending Validity" priority section for items missing expiry dates
 * - Quick consumption actions and custom portion drawer
 * - Product creation and editing (via ProductFormModal)
 * - Direct "Add to Shopping List" integration
 * - Consumption history visualization
 *
 * @param props.products - List of inventory products
 * @param props.categories - List of categories for grouping
 * @param props.search - Current search query
 * @param props.filters - Active status filters
 * @param props.onSearchChange - Handler for search input
 * @param props.onToggleFilter - Handler for status filters
 * @param props.onClearFilters - Handler to reset filters
 * @param props.onAddProduct - Handler for new product persistence
 * @param props.onUpdateProduct - Handler for product updates
 * @param props.onRemoveProduct - Handler for product deletion
 * @param props.onConsumeProduct - Handler for item consumption
 * @param props.onAddToShoppingList - Handler to add item to shopping list
 */
export const StockView = ({
  products,
  categories,
  search,
  filters,
  onSearchChange,
  onToggleFilter,
  onClearFilters,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
  onConsumeProduct = () => undefined,
  onAddToShoppingList,
  onAddCategory,
  onBulkUpdateValidity,
}: StockViewProps): ReactElement => {
  const [openForm, setOpenForm] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [pendingProduct, setPendingProduct] = useState<InventoryProduct | null>(null);
  const [pendingValidityDate, setPendingValidityDate] = useState<string>("");
  const [consumingProduct, setConsumingProduct] = useState<InventoryProduct | null>(null);
  const [customPortionCount, setCustomPortionCount] = useState<string>("1");
  const [historyProduct, setHistoryProduct] = useState<InventoryProduct | null>(null);

  const { isBulkMode, selectedItems, exitBulkMode } = useBulkStore();
  const [bulkDateDrawerOpen, setBulkDateDrawerOpen] = useState(false);
  const [bulkWarningOpen, setBulkWarningOpen] = useState(false);
  const [bulkValidityDate, setBulkValidityDate] = useState("");
  const [overwriteConflictMode, setOverwriteConflictMode] = useState<
    "only_missing" | "overwrite_all"
  >("only_missing");

  const hasFilters = filters.length > 0;

  const pendingProducts = useMemo(() => {
    const pending = products.filter((product) => product.needsValidity);
    if (!hasFilters) return pending;
    return pending.filter((product) => {
      const isLow = product.quantity > 0 && product.quantity <= product.minStock;
      const isOut = product.quantity === 0;
      return (filters.includes("low") && isLow) || (filters.includes("out") && isOut);
    });
  }, [products, hasFilters, filters]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      if (product.needsValidity) {
        return false;
      }

      const matchesSearch =
        normalizedSearch.length === 0 || product.name.toLowerCase().includes(normalizedSearch);
      const isLow = product.quantity > 0 && product.quantity <= product.minStock;
      const isOut = product.quantity === 0;
      const matchesFilter =
        !hasFilters || (filters.includes("low") && isLow) || (filters.includes("out") && isOut);

      return matchesSearch && matchesFilter;
    });
  }, [filters, hasFilters, products, search]);

  const groupedProducts = useMemo(() => {
    const grouped = new Map<string, InventoryProduct[]>();

    categories
      .slice()
      .sort((first, second) => first.order - second.order)
      .forEach((category) => {
        const categoryProducts = filteredProducts.filter(
          (product) => product.categoryId === category.id,
        );
        if (categoryProducts.length > 0) {
          grouped.set(category.id, categoryProducts);
        }
      });

    return grouped;
  }, [categories, filteredProducts]);

  const pendingGroupedProducts = useMemo(() => {
    const grouped = new Map<string, InventoryProduct[]>();

    categories
      .slice()
      .sort((first, second) => first.order - second.order)
      .forEach((category) => {
        const categoryProducts = pendingProducts.filter(
          (product) => product.categoryId === category.id,
        );

        if (categoryProducts.length > 0) {
          grouped.set(category.id, categoryProducts);
        }
      });

    return grouped;
  }, [categories, pendingProducts]);

  const lowStockCount = products.filter((product) => product.quantity <= product.minStock).length;
  const outOfStockCount = products.filter((product) => product.quantity === 0).length;
  const expiringCount = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return products.filter((product) => {
      if (!product.validityDate) return false;
      const expiry = new Date(product.validityDate + "T00:00:00");
      return expiry <= sevenDaysLater;
    }).length;
  }, [products]);

  const selectedProductsDetails = useMemo(() => {
    return products.filter((p) => selectedItems.includes(p.id));
  }, [products, selectedItems]);

  // Resolve category name from categoryId (UUID) via categories lookup.
  // Necessary because product.categoryId is a UUID, not a human-readable name.
  const getCategoryName = (categoryId?: string | null): string | null => {
    if (!categoryId) return null;
    const category = categories.find((c) => c.id === categoryId);
    return category?.name ?? null;
  };

  const isCleaningSuggested = useMemo(() => {
    if (selectedProductsDetails.length === 0) return false;
    const cleaningCount = selectedProductsDetails.filter((p) => {
      const name = getCategoryName(p.categoryId)?.toLowerCase() ?? "";
      return /limpeza|higiene/i.test(name);
    }).length;
    return cleaningCount / selectedProductsDetails.length >= 0.8;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductsDetails, categories]);

  const isIncompatibleCategories = useMemo(() => {
    if (selectedProductsDetails.length === 0) return false;
    const isFood = (name: string) =>
      /hortifruti|carnes|latic|graos|grãos|bebidas|padaria|comida|aliment/i.test(name);
    const isCleaning = (name: string) => /limpeza|higiene/i.test(name);
    const names = selectedProductsDetails
      .map((p) => getCategoryName(p.categoryId)?.toLowerCase() ?? "")
      .filter((n) => n.length > 0);
    const hasFood = names.some(isFood);
    const hasCleaning = names.some(isCleaning);
    return hasFood && hasCleaning;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductsDetails, categories]);

  const existingDatesCount = selectedProductsDetails.filter((p) => p.validityDate).length;
  const missingDatesCount = selectedProductsDetails.length - existingDatesCount;

  const handleBulkSetDateClick = () => {
    if (existingDatesCount > 0) {
      setOverwriteConflictMode("only_missing");
      setBulkWarningOpen(true);
    } else {
      setBulkDateDrawerOpen(true);
    }
  };

  const handleBulkSetDate = () => {
    if (!bulkValidityDate) return;
    let finalItems = selectedItems;
    if (existingDatesCount > 0 && overwriteConflictMode === "only_missing") {
      finalItems = selectedProductsDetails.filter((p) => !p.validityDate).map((p) => p.id);
    }
    if (finalItems.length === 0) {
      setBulkDateDrawerOpen(false);
      setBulkValidityDate("");
      exitBulkMode();
      return;
    }
    onBulkUpdateValidity?.(finalItems, bulkValidityDate, false)
      .then(() => {
        setBulkDateDrawerOpen(false);
        setBulkValidityDate("");
        exitBulkMode();
      })
      .catch((err) => {
        console.error("Falha ao atualizar validade em lote:", err);
      });
  };

  const handleBulkNaoAplica = () => {
    onBulkUpdateValidity?.(selectedItems, null, true)
      .then(() => {
        exitBulkMode();
      })
      .catch((err) => {
        console.error("Falha ao marcar itens como não perecíveis:", err);
      });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-300 bg-base-100/95 backdrop-blur space-y-3 sticky top-0 z-10">
        {isBulkMode ? (
          <div className="flex items-center justify-between gap-3 h-10">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={exitBulkMode}
                className="p-0 w-8 h-8 min-h-8"
              >
                <XOutlined />
              </Button>
              <h2 className="text-base font-semibold">{selectedItems.length} selecionados</h2>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">Estoque</h2>
                <p className="text-xs text-base-content/60">
                  {lowStockCount} baixo · {outOfStockCount} zerado
                  {expiringCount > 0 ? ` · ${expiringCount} vencendo` : ""}
                </p>
              </div>
              <Button variant="primary" size="sm" onClick={() => setOpenForm(true)}>
                Novo produto
              </Button>
            </div>

            <div className="flex gap-2">
              <Input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar produto"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={hasFilters ? "ghost" : "primary"}
                size="sm"
                className="rounded-full"
                onClick={onClearFilters}
              >
                Todos
              </Button>
              <Button
                variant={filters.includes("low") ? "primary" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => onToggleFilter("low")}
              >
                Baixos
              </Button>
              <Button
                variant={filters.includes("out") ? "primary" : "ghost"}
                size="sm"
                className="rounded-full"
                onClick={() => onToggleFilter("out")}
              >
                Zerados
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
        {pendingGroupedProducts.size > 0 && (
          <CategorySection
            name="Pendentes de Validade"
            products={pendingProducts}
            onEdit={(product) => {
              setEditingProduct(product);
              setOpenForm(true);
            }}
            onAddToList={onAddToShoppingList}
            onRemove={onRemoveProduct}
            onConsume={(product) => onConsumeProduct(product, 1)}
            onOpenCustomConsume={(product) => {
              setConsumingProduct(product);
              setCustomPortionCount("1");
            }}
            onCardClick={(product) => {
              setPendingProduct(product);
              setPendingValidityDate(product.validityDate ?? "");
            }}
            onViewHistory={(product) => setHistoryProduct(product)}
          />
        )}

        {groupedProducts.size === 0 ? (
          <div className="text-center text-sm text-base-content/60 py-12">
            Nenhum produto encontrado.
          </div>
        ) : (
          Array.from(groupedProducts.entries()).map(([categoryId, categoryProducts]) => {
            const category = categories.find((entry) => entry.id === categoryId);

            if (!category) {
              return null;
            }

            return (
              <CategorySection
                key={categoryId}
                name={category.name}
                products={categoryProducts}
                onEdit={(product) => {
                  setEditingProduct(product);
                  setOpenForm(true);
                }}
                onAddToList={onAddToShoppingList}
                onRemove={onRemoveProduct}
                onConsume={(product) => onConsumeProduct(product, 1)}
                onOpenCustomConsume={(product) => {
                  setConsumingProduct(product);
                  setCustomPortionCount("1");
                }}
                onCardClick={(product) => {
                  setEditingProduct(product);
                  setOpenForm(true);
                }}
                onViewHistory={(product) => setHistoryProduct(product)}
              />
            );
          })
        )}
      </div>

      {pendingProduct && (
        <Drawer
          open={Boolean(pendingProduct)}
          onClose={() => setPendingProduct(null)}
          title="Data de validade"
          subtitle={pendingProduct.name}
        >
          <div className="space-y-4">
            <div>
              <Input
                type="date"
                label="Data de validade"
                value={pendingValidityDate}
                onChange={(event) => setPendingValidityDate(event.target.value)}
              />
              <p className="text-xs text-base-content/60 mt-1">
                Assim que salvar, o item sai da área de pendentes e volta para a ordenação normal.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setPendingProduct(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (!pendingProduct || !pendingValidityDate.trim()) {
                    return;
                  }

                  onUpdateProduct(pendingProduct.id, {
                    ...pendingProduct,
                    validityDate: pendingValidityDate,
                    needsValidity: false,
                  });
                  setPendingProduct(null);
                  setPendingValidityDate("");
                }}
              >
                Salvar validade
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      {consumingProduct && (
        <Drawer
          open={Boolean(consumingProduct)}
          onClose={() => setConsumingProduct(null)}
          title="Consumo customizado"
          subtitle={consumingProduct.name}
        >
          <div className="space-y-4">
            <div>
              <Input
                type="number"
                min="0.1"
                step="0.1"
                label="Quantidade em porções"
                value={customPortionCount}
                onChange={(event) => setCustomPortionCount(event.target.value)}
              />
              <p className="text-xs text-base-content/60 mt-1">
                1 porção = {consumingProduct.portionSize ?? 1} {consumingProduct.unit ?? "Un"}
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setConsumingProduct(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  if (!consumingProduct) {
                    return;
                  }

                  const portions = Number.parseFloat(customPortionCount);
                  if (!Number.isFinite(portions) || portions <= 0) {
                    return;
                  }

                  onConsumeProduct(consumingProduct, portions);
                  setConsumingProduct(null);
                  setCustomPortionCount("1");
                }}
              >
                Consumir
              </Button>
            </div>
          </div>
        </Drawer>
      )}

      <ProductFormModal
        key={`${editingProduct?.id ?? "new"}-${openForm ? "open" : "closed"}`}
        open={openForm}
        product={editingProduct}
        categories={categories}
        onClose={() => {
          setOpenForm(false);
          setEditingProduct(null);
        }}
        onSave={(product, productId) => {
          if (productId) {
            onUpdateProduct(productId, product);
            return;
          }

          onAddProduct(product);
        }}
        onAddCategory={onAddCategory}
      />

      {historyProduct && (
        <ConsumptionHistoryDrawer
          open={Boolean(historyProduct)}
          onClose={() => setHistoryProduct(null)}
          stockItemId={historyProduct.id}
          productName={historyProduct.name}
        />
      )}

      {isBulkMode && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-base-100 border-t border-base-300 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 animate-slide-up">
          <div className="flex items-center justify-between gap-2 max-w-md mx-auto">
            <div className="flex-1 relative group">
              <Button
                variant="secondary"
                className="w-full relative"
                onClick={handleBulkNaoAplica}
                disabled={selectedItems.length === 0 || isIncompatibleCategories}
              >
                Não se aplica
                {isCleaningSuggested && !isIncompatibleCategories && (
                  <span className="absolute -top-2 -right-2 bg-info text-info-content text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm animate-pulse">
                    Recomendado
                  </span>
                )}
              </Button>
              {isIncompatibleCategories && (
                <div className="absolute bottom-full mb-2 hidden group-hover:block w-48 p-2 bg-base-300 text-xs rounded shadow-lg text-center left-1/2 -translate-x-1/2">
                  Selecione apenas itens do mesmo tipo (ex: só limpeza ou só alimentos).
                </div>
              )}
            </div>
            <Button
              variant="primary"
              className="flex-1"
              onClick={handleBulkSetDateClick}
              disabled={selectedItems.length === 0}
            >
              Definir Validade
            </Button>
          </div>
        </div>
      )}

      {bulkDateDrawerOpen && (
        <Drawer
          open={bulkDateDrawerOpen}
          onClose={() => setBulkDateDrawerOpen(false)}
          title="Definir Validade"
          subtitle={`${selectedItems.length} itens selecionados`}
        >
          <div className="space-y-4">
            <Input
              type="date"
              label="Data de validade"
              value={bulkValidityDate}
              onChange={(e) => setBulkValidityDate(e.target.value)}
            />
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setBulkDateDrawerOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={handleBulkSetDate}
                disabled={!bulkValidityDate}
              >
                Salvar validade
              </Button>
            </div>
          </div>
        </Drawer>
      )}
      {bulkWarningOpen && (
        <Drawer
          open={bulkWarningOpen}
          onClose={() => setBulkWarningOpen(false)}
          title="Atenção"
          subtitle="Itens com validade"
        >
          <div className="space-y-4">
            <p className="text-sm text-base-content/80">
              {existingDatesCount}{" "}
              {existingDatesCount === 1 ? "item já possui" : "itens já possuem"} uma data de
              validade definida.
            </p>
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="overwriteConflictMode"
                  className="radio radio-primary radio-sm"
                  checked={overwriteConflictMode === "only_missing"}
                  onChange={() => setOverwriteConflictMode("only_missing")}
                />
                <span className="text-sm">Aplicar apenas aos {missingDatesCount} sem data</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="overwriteConflictMode"
                  className="radio radio-primary radio-sm"
                  checked={overwriteConflictMode === "overwrite_all"}
                  onChange={() => setOverwriteConflictMode("overwrite_all")}
                />
                <span className="text-sm">
                  Substituir para todos os {selectedProductsDetails.length} itens
                </span>
              </label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setBulkWarningOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                className="flex-1"
                onClick={() => {
                  setBulkWarningOpen(false);
                  setBulkDateDrawerOpen(true);
                }}
              >
                Continuar
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
};
