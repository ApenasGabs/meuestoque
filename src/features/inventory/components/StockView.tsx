import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/Button/Button";
import { Input } from "../../../components/Input/Input";
import type { InventoryCategory, InventoryProduct } from "../types";
import type { StockFilter } from "../useInventoryFeature";
import { CategorySection } from "./CategorySection";
import { ProductFormModal } from "./ProductFormModal";

interface StockViewProps {
  products: InventoryProduct[];
  categories: InventoryCategory[];
  search: string;
  filter: StockFilter;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: StockFilter) => void;
  onAddProduct: (product: Omit<InventoryProduct, "id">) => void;
  onUpdateProduct: (id: string, product: Omit<InventoryProduct, "id">) => void;
  onRemoveProduct: (id: string) => void;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onAddToShoppingList: (product: InventoryProduct) => void;
  onAddCategory: (name: string) => string;
}

export const StockView = ({
  products,
  categories,
  search,
  filter,
  onSearchChange,
  onFilterChange,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
  onUpdateQuantity,
  onAddToShoppingList,
  onAddCategory,
}: StockViewProps): ReactElement => {
  const [openForm, setOpenForm] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<InventoryProduct | null>(null);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        normalizedSearch.length === 0 || product.name.toLowerCase().includes(normalizedSearch);
      const isLow = product.quantity > 0 && product.quantity <= product.minStock;
      const isOut = product.quantity === 0;
      const matchesFilter =
        filter === "all" || (filter === "low" && isLow) || (filter === "out" && isOut);

      return matchesSearch && matchesFilter;
    });
  }, [filter, products, search]);

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

  const lowStockCount = products.filter((product) => product.quantity <= product.minStock).length;
  const outOfStockCount = products.filter((product) => product.quantity === 0).length;

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-300 bg-base-100 space-y-3 sticky top-0 z-10">
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
          <select
            className="select select-bordered w-36"
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as StockFilter)}
          >
            <option value="all">Todos</option>
            <option value="low">Baixos</option>
            <option value="out">Zerados</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
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
                onDecrease={(product) => onUpdateQuantity(product.id, product.quantity - 1)}
                onIncrease={(product) => onUpdateQuantity(product.id, product.quantity + 1)}
              />
            );
          })
        )}
      </div>

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
