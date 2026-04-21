import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Button } from "../../../components/Button/Button";
import { Input } from "../../../components/Input/Input";
import { Label } from "../../../components/Label/Label";
import type { InventoryProduct, ShoppingListItem } from "../types";
import { ShoppingListItem as ShoppingListRow } from "./ShoppingListItem";

interface ShoppingListViewProps {
  products: InventoryProduct[];
  shoppingList: ShoppingListItem[];
  checkedCount: number;
  uncheckedCount: number;
  onAddToList: (productId: string, quantity: number) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDecrease: (id: string) => void;
  onIncrease: (id: string) => void;
  onBuy: (id: string) => void;
  onClearChecked: () => void;
  onGenerateSmartList: () => void;
}

export const ShoppingListView = ({
  products,
  shoppingList,
  checkedCount,
  uncheckedCount,
  onAddToList,
  onToggle,
  onRemove,
  onDecrease,
  onIncrease,
  onBuy,
  onClearChecked,
  onGenerateSmartList,
}: ShoppingListViewProps): ReactElement => {
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id ?? "");
  const [manualQuantity, setManualQuantity] = useState<string>("1");

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? products[0] ?? null,
    [products, selectedProductId],
  );

  const handleManualAdd = (): void => {
    if (!selectedProduct) {
      return;
    }

    onAddToList(selectedProduct.id, Math.max(1, Number(manualQuantity) || 1));
    setManualQuantity("1");
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <Label htmlFor="manual-product">Adicionar manualmente</Label>
            <select
              id="manual-product"
              className="select select-bordered w-full"
              value={selectedProductId}
              onChange={(event) => setSelectedProductId(event.target.value)}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="manual-qty">Qtd</Label>
            <Input
              id="manual-qty"
              type="number"
              min="1"
              value={manualQuantity}
              onChange={(event) => setManualQuantity(event.target.value)}
              className="w-24"
            />
          </div>
          <div className="flex items-end">
            <Button variant="primary" className="w-full" onClick={handleManualAdd}>
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
              <ShoppingListRow
                key={item.id}
                item={item}
                product={product}
                onToggle={onToggle}
                onRemove={onRemove}
                onDecrease={onDecrease}
                onIncrease={onIncrease}
                onBuy={onBuy}
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
