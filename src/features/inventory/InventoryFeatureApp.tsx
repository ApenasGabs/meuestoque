import type { ReactElement } from "react";
import { Badge } from "../../components/Badge/Badge";
import { Button } from "../../components/Button/Button";
import { ShoppingListView } from "./components/ShoppingListView";
import { StockView } from "./components/StockView";
import { useInventoryFeature } from "./useInventoryFeature";

export const InventoryFeatureApp = (): ReactElement => {
  const {
    products,
    categories,
    shoppingList,
    activeTab,
    search,
    filter,
    lowStockCount,
    outOfStockCount,
    checkedCount,
    uncheckedCount,
    setActiveTab,
    setSearch,
    setFilter,
    addProduct,
    updateProduct,
    removeProduct,
    addCategory,
    updateQuantity,
    addToShoppingList,
    toggleItemChecked,
    removeFromShoppingList,
    updateShoppingQuantity,
    markItemAsBought,
    clearCheckedItems,
    generateSmartList,
  } = useInventoryFeature();

  return (
    <div className="bg-base-200 min-h-screen flex flex-col">
      <header className="bg-base-100 border-b border-base-300 px-4 py-3 sticky top-0 z-20 flex items-center justify-between gap-3">
        <div className="leading-tight">
          <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
            Meu Estoque
          </p>
          <h1 className="text-base font-semibold tracking-tight">Estoque e Lista de Compras</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Badge variant="warning" size="sm">
            {lowStockCount} baixo
          </Badge>
          <Badge variant="error" size="sm">
            {outOfStockCount} zerado
          </Badge>
        </div>
      </header>

      <main className="flex-1 overflow-hidden flex flex-col">
        {activeTab === "stock" ? (
          <StockView
            products={products}
            categories={categories}
            search={search}
            filter={filter}
            onSearchChange={setSearch}
            onFilterChange={setFilter}
            onAddProduct={addProduct}
            onUpdateProduct={updateProduct}
            onRemoveProduct={removeProduct}
            onUpdateQuantity={updateQuantity}
            onAddToShoppingList={(product) =>
              addToShoppingList(product.id, Math.max(product.minStock - product.quantity + 1, 1))
            }
            onAddCategory={addCategory}
          />
        ) : (
          <ShoppingListView
            products={products}
            shoppingList={shoppingList}
            checkedCount={checkedCount}
            uncheckedCount={uncheckedCount}
            onAddToList={addToShoppingList}
            onToggle={toggleItemChecked}
            onRemove={removeFromShoppingList}
            onDecrease={(id) => {
              const currentQuantity = shoppingList.find((item) => item.id === id)?.quantity ?? 1;
              updateShoppingQuantity(id, Math.max(1, currentQuantity - 1));
            }}
            onIncrease={(id) => {
              const currentQuantity = shoppingList.find((item) => item.id === id)?.quantity ?? 1;
              updateShoppingQuantity(id, currentQuantity + 1);
            }}
            onBuy={markItemAsBought}
            onClearChecked={clearCheckedItems}
            onGenerateSmartList={generateSmartList}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex z-30">
        <Button
          variant="ghost"
          className={`flex-1 rounded-none ${activeTab === "stock" ? "text-primary" : "text-base-content/60"}`}
          onClick={() => setActiveTab("stock")}
        >
          Estoque
          {lowStockCount > 0 && (
            <Badge variant="warning" size="sm" className="ml-2">
              {lowStockCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          className={`flex-1 rounded-none ${activeTab === "list" ? "text-primary" : "text-base-content/60"}`}
          onClick={() => setActiveTab("list")}
        >
          Lista
          {uncheckedCount > 0 && (
            <Badge variant="error" size="sm" className="ml-2">
              {uncheckedCount}
            </Badge>
          )}
        </Button>
      </nav>
    </div>
  );
};
