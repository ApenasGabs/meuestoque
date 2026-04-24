import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Input } from "../../../../components/Input/Input";
import { Label } from "../../../../components/Label/Label";
import type { InventoryProduct, InventoryShoppingListItem } from "../../types";
import { ShoppingListItem } from "../shoppingListItem/ShoppingListItem";

interface SmartShoppingDraft {
  name: string;
  quantity: number;
  price: number | null;
  hasQuantity: boolean;
  unit: string;
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
  onBuy: (id: string) => void;
  onClearChecked: () => void;
  onGenerateSmartList: () => void;
  onFinalizeShopping?: () => void;
  onUpdateItemPrice?: (id: string, value: number | null) => void;
}

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
  onBuy,
  onClearChecked,
  onGenerateSmartList,
  onFinalizeShopping,
  onUpdateItemPrice,
}: ShoppingListViewProps): ReactElement => {
  const [smartInput, setSmartInput] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("un");

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
    };
  }, [selectedUnit, smartInput]);

  const handleSmartSubmit = (): void => {
    if (!parsedDraft.name.trim()) {
      return;
    }

    onSmartAdd(parsedDraft);
    setSmartInput("");
    setSelectedUnit("un");
  };

  const handleSmartKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSmartSubmit();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-base-300 bg-base-100 sticky top-0 z-10 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Lista de Compras</h2>
            <p className="text-xs text-base-content/60">
              {uncheckedCount} pendentes · {checkedCount} comprados
            </p>
          </div>
          <div className="flex gap-2">
            {onFinalizeShopping && (
              <Button
                variant="primary"
                size="sm"
                onClick={onFinalizeShopping}
                disabled={finalizeDisabled}
              >
                {finalizing ? "Finalizando..." : "Finalizar compra"}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={onGenerateSmartList}>
              Lista inteligente
            </Button>
            {checkedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearChecked}>
                Limpar comprados
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
            {parsedDraft.price !== null && (
              <Badge variant="warning" size="sm">
                R$ {parsedDraft.price.toFixed(2).replace(".", ",")}
              </Badge>
            )}
            {parsedDraft.hasQuantity && (
              <div className="flex items-center gap-2">
                <Label htmlFor="smart-unit" className="text-xs">
                  Unidade
                </Label>
                <select
                  id="smart-unit"
                  className="select select-bordered select-sm"
                  value={selectedUnit}
                  onChange={(event) => setSelectedUnit(event.target.value)}
                >
                  <option value="kg">kg</option>
                  <option value="L">L</option>
                  <option value="un">un</option>
                  <option value="composta">composta</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex items-end">
            <Button variant="primary" className="w-full" onClick={handleSmartSubmit}>
              Adicionar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-28">
        {shoppingList.length === 0 ? (
          <div className="text-center text-sm text-base-content/60 py-12">
            Lista vazia. Gere uma lista inteligente ou adicione itens.
          </div>
        ) : (
          shoppingList.map((item) => {
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
                onBuy={onBuy}
                onUpdatePrice={onUpdateItemPrice}
              />
            );
          })
        )}
      </div>

      <div className="fixed bottom-16 left-0 right-0 px-4 pb-3">
        <Button
          variant="primary"
          className="w-full"
          onClick={onClearChecked}
          disabled={checkedCount === 0}
        >
          Remover itens comprados
        </Button>
      </div>
    </div>
  );
};
