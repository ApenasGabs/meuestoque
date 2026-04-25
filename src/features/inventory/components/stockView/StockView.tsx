import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Button } from "../../../../components/Button/Button";
import { Drawer } from "../../../../components/Drawer/Drawer";
import { Input } from "../../../../components/Input/Input";
import type { InventoryCategory, InventoryProduct, StockFilter } from "../../types";
import { CategorySection } from "../categorySection/CategorySection";
import { ProductFormModal } from "../productFormModal/ProductFormModal";

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
}

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
}: StockViewProps): ReactElement => {
  const [openForm, setOpenForm] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);
  const [pendingProduct, setPendingProduct] = useState<InventoryProduct | null>(null);
  const [pendingValidityDate, setPendingValidityDate] = useState<string>("");
  const [consumingProduct, setConsumingProduct] = useState<InventoryProduct | null>(null);
  const [customPortionCount, setCustomPortionCount] = useState<string>("1");
  const hasFilters = filters.length > 0;

  const pendingProducts = useMemo(
    () => products.filter((product) => product.needsValidity),
    [products],
  );

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

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-300 bg-base-100/95 backdrop-blur space-y-3 sticky top-0 z-10">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Estoque</h2>
            <p className="text-xs text-base-content/60">
              {lowStockCount} baixo · {outOfStockCount} zerado
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
    </div>
  );
};
