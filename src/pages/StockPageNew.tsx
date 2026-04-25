import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { StockView } from "../features/inventory/components/stockView/StockView";
import { useInventoryFeatureWeb } from "../features/inventory/useInventoryFeatureWeb";
import type { InventoryProduct } from "../features/inventory/types";
import { useGroupStore } from "../stores/groupStore";
import { useStockStore } from "../stores/stockStore";
import { Toast } from "../components/Toast/Toast";

/**
 * New Stock Page with integrated inventory feature using latest UX
 * Shows stock items with validity pending section, multi-select filters, and product editing
 */
export const StockPageNew = (): ReactElement => {
  const navigate = useNavigate();
  const groupId = useGroupStore((state) => state.groupId);
  const fetchItems = useStockStore((state) => state.fetchItems);
  const [search, setSearch] = useState<string>("");
  const [filters, setFilters] = useState<Array<"low" | "out">>([]);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const {
    products,
    categories,
    loading,
    addProduct,
    updateProduct,
    removeProduct,
    updateQuantity,
    toggleInShoppingList,
    lastAutoAddedItemName,
  } = useInventoryFeatureWeb();
  
  const clearAutoAddedNotice = useStockStore((state) => state.clearAutoAddedNotice);

  useEffect(() => {
    if (!groupId) {
      navigate("/group");
      return;
    }

    void fetchItems(groupId);
  }, [groupId, fetchItems, navigate]);

  useEffect(() => {
    if (lastAutoAddedItemName) {
      const timer = setTimeout(() => {
        setToast({ 
          message: `${lastAutoAddedItemName} atingiu estoque mínimo e foi para a lista!`, 
          type: "success" 
        });
        clearAutoAddedNotice();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [lastAutoAddedItemName, clearAutoAddedNotice]);

  const handleAddToShoppingList = async (product: InventoryProduct): Promise<void> => {
    if (!groupId) return;
    try {
      await toggleInShoppingList(product.id, true);
      setToast({ message: `${product.name} marcado para compra!`, type: "success" });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Falha ao adicionar à lista",
        type: "error",
      });
    }
  };

  const handleAddProduct = async (product: Omit<InventoryProduct, "id">): Promise<void> => {
    await addProduct(product);
  };

  const handleUpdateProduct = async (
    id: string,
    product: Omit<InventoryProduct, "id">,
  ): Promise<void> => {
    await updateProduct(id, product);
  };

  const handleRemoveProduct = async (id: string): Promise<void> => {
    await removeProduct(id);
  };

  const handleConsumeProduct = async (
    product: InventoryProduct,
    portions: number = 1,
  ): Promise<void> => {
    const portionSize = product.portionSize ?? 1;
    const delta = -1 * Math.max(0, portions) * Math.max(0.0001, portionSize);
    if (delta === 0) {
      return;
    }

    await updateQuantity(product.id, delta);
  };

  const handleAddCategory = (name: string): string => {
    // Categories are extracted from products in web hook
    return name;
  };

  if (!groupId) {
    return <Alert type="warning">Selecione um grupo para continuar</Alert>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <div className="flex-1 overflow-y-auto pb-20">
        <StockView
          products={products}
          categories={categories}
          search={search}
          filters={filters}
          onSearchChange={setSearch}
          onToggleFilter={(filter) => {
            setFilters((prev) =>
              prev.includes(filter) ? prev.filter((f) => f !== filter) : [...prev, filter],
            );
          }}
          onClearFilters={() => setFilters([])}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onRemoveProduct={handleRemoveProduct}
          onConsumeProduct={(product, portions) => void handleConsumeProduct(product, portions)}
          onAddToShoppingList={handleAddToShoppingList}
          onAddCategory={handleAddCategory}
        />
      </div>

      {toast && (
        <Toast
          visible={Boolean(toast)}
          type={toast.type}
          onDismiss={() => setToast(null)}
        >
          {toast.message}
        </Toast>
      )}
    </div>
  );
};
