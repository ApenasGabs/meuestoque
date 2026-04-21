import type { ReactElement } from "react";
import { Badge } from "../../components/Badge/Badge";
import { Button } from "../../components/Button/Button";
import { Card, CardBody, CardTitle } from "../../components/Card/Card";
import { Label } from "../../components/Label/Label";
import ThemeSelector from "../../components/ThemeSelector/ThemeSelector";
import {
  FONT_SIZE_LABELS,
  FONT_SIZE_OPTIONS,
  getStoredTheme,
  useFontSizePreference,
} from "../../hooks/usePreferences";
import { ShoppingListView } from "./components/shoppingListView/ShoppingListView";
import { StockView } from "./components/stockView/StockView";
import { useInventoryFeature } from "./useInventoryFeature";

const GearIcon = (): ReactElement => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="h-5 w-5"
  >
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.04a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.04a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 6.03 4.2l.06.06A1.7 1.7 0 0 0 7 4.6c.67 0 1.27-.39 1.56-1V3a2 2 0 1 1 4 0v.04c.29.61.89 1 1.56 1 .54 0 1.04-.21 1.41-.58l.06-.06A2 2 0 1 1 19.8 6.03l-.06.06c-.37.37-.58.87-.58 1.41 0 .67.39 1.27 1 1.56H21a2 2 0 1 1 0 4h-.04c-.61.29-1 .89-1 1.56Z" />
  </svg>
);

const SettingsView = (): ReactElement => {
  const { fontSize, setFontSize } = useFontSizePreference();
  const storedTheme = getStoredTheme();

  return (
    <div className="flex-1 overflow-y-auto p-4 pb-28">
      <Card className="max-w-2xl mx-auto">
        <CardBody className="space-y-6">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-primary font-semibold mb-1">
              Configurações
            </p>
            <CardTitle className="mb-2">Preferências do app</CardTitle>
            <p className="text-sm text-base-content/70">
              Ajustes rápidos para manter a experiência do estoque no seu fluxo.
            </p>
          </div>

          <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
            <Label>Tema</Label>
            <ThemeSelector />
            <p className="text-xs text-base-content/60">Tema salvo: {storedTheme}</p>
          </div>

          <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
            <Label>Tamanho da fonte</Label>
            <div className="flex flex-wrap gap-2">
              {FONT_SIZE_OPTIONS.map((size) => (
                <Button
                  key={size}
                  variant={fontSize === size ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setFontSize(size)}
                >
                  {FONT_SIZE_LABELS[size]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-base-content/60 mt-2">
              Tamanho salvo: {FONT_SIZE_LABELS[fontSize]} · escolha o ideal para tablet/celular
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-2">
              <Label>Notificações de estoque</Label>
              <p className="text-sm text-base-content/70">
                Receba um alerta quando itens ficarem abaixo do mínimo.
              </p>
              <Badge variant="warning" size="sm">
                Em breve
              </Badge>
            </div>

            <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-2">
              <Label>Lista automática</Label>
              <p className="text-sm text-base-content/70">
                Gere compras inteligentes com base no estoque atual.
              </p>
              <Badge variant="info" size="sm">
                Ativo
              </Badge>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};

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
          {/* <h1 className="text-base font-semibold tracking-tight">Estoque e Lista de Compras</h1> */}
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
        ) : activeTab === "list" ? (
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
        ) : (
          <SettingsView />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex z-30">
        <Button
          variant="ghost"
          className={`flex-1 rounded-none h-16 flex-col gap-1 ${activeTab === "stock" ? "text-primary" : "text-base-content/60"}`}
          onClick={() => setActiveTab("stock")}
        >
          <span className="text-xs uppercase tracking-wide">Estoque</span>
          {lowStockCount > 0 && (
            <Badge variant="warning" size="sm" className="ml-2">
              {lowStockCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          className={`flex-1 rounded-none h-16 flex-col gap-1 ${activeTab === "list" ? "text-primary" : "text-base-content/60"}`}
          onClick={() => setActiveTab("list")}
        >
          <span className="text-xs uppercase tracking-wide">Lista</span>
          {uncheckedCount > 0 && (
            <Badge variant="error" size="sm" className="ml-2">
              {uncheckedCount}
            </Badge>
          )}
        </Button>

        <Button
          variant="ghost"
          className={`flex-1 rounded-none h-16 flex-col gap-1 ${activeTab === "settings" ? "text-primary" : "text-base-content/60"}`}
          onClick={() => setActiveTab("settings")}
          aria-label="Abrir configurações do app"
        >
          <GearIcon />
          <span className="text-xs uppercase tracking-wide">Config</span>
        </Button>
      </nav>
    </div>
  );
};
