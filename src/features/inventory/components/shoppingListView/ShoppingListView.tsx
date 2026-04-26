import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Input } from "../../../../components/Input/Input";
import { Label } from "../../../../components/Label/Label";
import { Select } from "../../../../components/Select/Select";
import type { InventoryProduct, InventoryShoppingListItem } from "../../types";
import { ShoppingListItem } from "../shoppingListItem/ShoppingListItem";
import { toUnit, type Unit } from "../../../../types/inventory.types";

interface SmartShoppingDraft {
  name: string;
  quantity: number;
  price: number | null;
  hasQuantity: boolean;
  unit: Unit;
  category: string;
}

interface ShoppingListViewProps {
  products: InventoryProduct[];
  shoppingList: InventoryShoppingListItem[];
  checkedCount: number;
  uncheckedCount: number;
  finalizing?: boolean;
  finalizeDisabled?: boolean;
  onSmartAdd: (draft: SmartShoppingDraft) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onGenerateSmartList: () => void;
  onFinalizeShopping?: () => void;
  onUpdateItemPrice?: (id: string, value: number | null) => void;
  onUpdateItemUnitPrice?: (id: string, value: number | null) => void;
  onUpdateItemQuantity?: (id: string, value: number) => void;
  onUpdateValidityDate?: (id: string, date: string | null) => void;
  onOpenImportModal?: () => void;
  onViewHistory?: () => void;
}

/**
 * Container component for the Shopping List feature.
 * 
 * Features:
 * - Smart input parser (Name, Qty, Price) for fast entry
 * - Categorized list view with tabs
 * - Automatic "Smart List" generation based on low stock
 * - Total value calculation
 * - Receipt import modal integration
 * - Sticky header with list stats
 * 
 * @param props.products - Full list of products (for name matching)
 * @param props.shoppingList - Items currently in the active list
 * @param props.checkedCount - Number of items already in cart
 * @param props.uncheckedCount - Number of items still pending
 * @param props.finalizing - Loading state for finalization
 * @param props.finalizeDisabled - Validation state for the finalize button
 * @param props.onSmartAdd - Handler for the smart input parser
 * @param props.onToggle - Handler for item purchased state
 * @param props.onRemove - Handler for item deletion
 * @param props.onGenerateSmartList - Handler for the smart list engine
 * @param props.onFinalizeShopping - Handler for list completion workflow
 */
export const ShoppingListView = ({
  products,
  shoppingList,
  checkedCount,
  uncheckedCount,
  finalizing = false,
  finalizeDisabled = false,
  onSmartAdd,
  onToggle,
  onRemove,
  onGenerateSmartList,
  onFinalizeShopping,
  onUpdateItemPrice,
  onUpdateItemUnitPrice,
  onUpdateItemQuantity,
  onUpdateValidityDate,
  onOpenImportModal,
  onViewHistory,
}: ShoppingListViewProps): ReactElement => {
  const [smartInput, setSmartInput] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<Unit>("Un");
  const [selectedCategoryForDraft, setSelectedCategoryForDraft] = useState<string>("Outros");
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");

  const categories = [
    "Todos",
    "🥦 Hortifruti",
    "🥩 Carnes",
    "🥛 Laticínios",
    "🧹 Limpeza",
    "🌾 Grãos",
    "🍪 Outros",
  ];

  const parsedDraft = useMemo<SmartShoppingDraft>(() => {
    const parts = smartInput
      .split(",")
      .map((part) => part.trim())
      .filter((part) => part.length > 0);

    const name = parts[0] ?? "";
    const quantityValue = parts[1] ? Number.parseFloat(parts[1].replace(",", ".")) : 1;
    const priceValue = parts[2] ? Number.parseFloat(parts[2].replace(",", ".")) : null;
    const hasQuantity = parts.length >= 2 && !Number.isNaN(quantityValue) && quantityValue > 0;

    return {
      name,
      quantity: hasQuantity ? quantityValue : 1,
      price: priceValue !== null && !Number.isNaN(priceValue) ? priceValue : null,
      hasQuantity,
      unit: selectedUnit,
      category: selectedCategoryForDraft,
    };
  }, [selectedCategoryForDraft, selectedUnit, smartInput]);

  const handleSmartSubmit = (): void => {
    if (!parsedDraft.name.trim()) {
      return;
    }

    onSmartAdd(parsedDraft);
    setSmartInput("");
    setSelectedUnit("Un");
    setSelectedCategoryForDraft("Outros");
  };

  const handleSmartKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSmartSubmit();
    }
  };

  const totalValue = useMemo(() => {
    return shoppingList.reduce((sum, item) => sum + (item.price || 0), 0);
  }, [shoppingList]);

  const filteredList = useMemo(() => {
    if (selectedCategory === "Todos") return shoppingList;
    return shoppingList.filter((item) => {
      const product = products.find((p) => p.id === item.productId);
      const isOther = selectedCategory === "🍪 Outros";
      return product?.categoryId === selectedCategory || (isOther && !product?.categoryId);
    });
  }, [shoppingList, products, selectedCategory]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-300 bg-base-100 sticky top-0 z-10 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Lista de Compras</h2>
            <p className="text-xs text-base-content/60">
              {uncheckedCount} pendentes · {checkedCount} comprados
              {totalValue > 0 && ` · R$ ${totalValue.toFixed(2).replace(".", ",")}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={onGenerateSmartList}>
              Lista inteligente
            </Button>
            {onOpenImportModal && (
              <Button variant="ghost" size="sm" onClick={onOpenImportModal}>
                Importar compra
              </Button>
            )}
            {onViewHistory && (
              <Button variant="ghost" size="sm" onClick={onViewHistory}>
                Histórico
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="smart-shopping-input">Adicionar item rápido</Label>
            <Input
              id="smart-shopping-input"
              value={smartInput}
              onChange={(event) => setSmartInput(event.target.value)}
              onKeyDown={handleSmartKeyDown}
              placeholder="Nome, quantidade, valor"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/70">
            <Badge variant={parsedDraft.name ? "info" : "default"} size="sm">
              {parsedDraft.name || "Digite o nome"}
            </Badge>
            <Badge variant="secondary" size="sm">
              Qtd {parsedDraft.quantity}
            </Badge>

            <Badge variant="warning" size="sm">
              R$ {parsedDraft?.price?.toFixed(2).replace(".", ",") || 0}
            </Badge>
            {parsedDraft.hasQuantity && (
              <div className="flex items-center gap-2">
                <Label htmlFor="smart-unit" className="text-xs">
                  Unidade
                </Label>
                <Select
                  id="smart-unit"
                  size="sm"
                  value={selectedUnit}
                  onChange={(event) => setSelectedUnit(toUnit(event.target.value))}
                  options={[
                    { value: "Kg", label: "Kg" },
                    { value: "L", label: "L" },
                    { value: "Un", label: "Un" },
                    { value: "cx", label: "cx" },
                    { value: "pct", label: "pct" },
                  ]}
                />
              </div>
            )}

            {(parsedDraft.hasQuantity || smartInput.includes(",")) && (
              <div className="flex items-center gap-2">
                <Label htmlFor="smart-category" className="text-xs">
                  Categoria
                </Label>
                <Select
                  id="smart-category"
                  size="sm"
                  value={selectedCategoryForDraft}
                  onChange={(event) => setSelectedCategoryForDraft(event.target.value)}
                  options={categories
                    .filter((c) => c !== "Todos")
                    .map((c) => ({
                      value: c,
                      label: c,
                    }))}
                />
              </div>
            )}
          </div>

          <div className="flex items-end">
            <Button variant="primary" className="w-full" onClick={handleSmartSubmit}>
              Adicionar
            </Button>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide -mx-2 px-2">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "primary" : "ghost"}
              size="sm"
              className="whitespace-nowrap rounded-full font-medium"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-28">
        {filteredList.length === 0 ? (
          <div className="text-center text-sm text-base-content/60 py-12">
            Nenhum item encontrado.
          </div>
        ) : (
          filteredList.map((item) => {
            const product = products.find((currentProduct) => currentProduct.id === item.productId);

            if (!product) {
              return null;
            }

            return (
              <ShoppingListItem
                key={item.id}
                item={item}
                product={product}
                onToggle={onToggle}
                onRemove={onRemove}
                onUpdatePrice={onUpdateItemPrice}
                onUpdateUnitPrice={onUpdateItemUnitPrice}
                onUpdateQuantity={onUpdateItemQuantity}
                onUpdateValidityDate={onUpdateValidityDate}
              />
            );
          })
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3">
        {checkedCount > 0 && onFinalizeShopping && (
          <Button
            variant="primary"
            className="w-full"
            size="sm"
            onClick={onFinalizeShopping}
            disabled={finalizeDisabled}
          >
            {finalizing ? "Finalizando..." : "Finalizar compra"}
          </Button>
        )}
      </div>
    </div>
  );
};
