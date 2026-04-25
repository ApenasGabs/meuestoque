import type { ReactElement } from "react";
import { useState } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Card, CardBody } from "../../../../components/Card/Card";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";
import { Input } from "../../../../components/Input/Input";
import type { InventoryProduct, InventoryShoppingListItem } from "../../types";

interface ShoppingListItemProps {
  item: InventoryShoppingListItem;
  product: InventoryProduct;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdatePrice?: (id: string, value: number | null) => void;
  onUpdateQuantity?: (id: string, value: number) => void;
}

export const ShoppingListItem = ({
  item,
  product,
  onToggle,
  onRemove,
  onUpdatePrice,
  onUpdateQuantity,
}: ShoppingListItemProps): ReactElement => {
  const [prevQuantity, setPrevQuantity] = useState(item.quantity);
  const [quantityDraft, setQuantityDraft] = useState<string>(String(item.quantity));
  const [prevPrice, setPrevPrice] = useState(item.price);
  const [priceDraft, setPriceDraft] = useState<string>(
    item.price !== null && item.price !== undefined ? item.price.toFixed(2).replace(".", ",") : "",
  );

  if (item.price !== prevPrice) {
    setPrevPrice(item.price);
    setPriceDraft(
      item.price !== null && item.price !== undefined
        ? item.price.toFixed(2).replace(".", ",")
        : "",
    );
  }

  if (item.quantity !== prevQuantity) {
    setPrevQuantity(item.quantity);
    setQuantityDraft(String(item.quantity));
  }

  const handleQuantityBlur = (): void => {
    if (!onUpdateQuantity) return;
    const parsed = Number.parseFloat(quantityDraft.replace(",", "."));
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdateQuantity(item.id, parsed);
    } else {
      setQuantityDraft(String(item.quantity));
    }
  };

  const handlePriceBlur = (): void => {
    if (!onUpdatePrice) return;

    const normalizedValue = priceDraft.trim();
    if (normalizedValue.length === 0) {
      onUpdatePrice(item.id, null);
      return;
    }

    const parsed = Number.parseFloat(normalizedValue.replace(",", "."));
    if (Number.isNaN(parsed)) {
      setPriceDraft(
        item.price !== null && item.price !== undefined
          ? item.price.toFixed(2).replace(".", ",")
          : "",
      );
      return;
    }

    onUpdatePrice(item.id, parsed);
  };

  return (
    <Card
      className={`shadow-none ${item.checked ? "opacity-70 border-base-300" : "border-base-300"}`}
    >
      <CardBody className="p-3">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={item.checked}
            onChange={() => onToggle(item.id)}
            aria-label={`Marcar ${product.name}`}
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={`text-sm font-medium ${item.checked ? "line-through text-base-content/50" : ""}`}
              >
                {product.name}
              </p>
              {item.checked && (
                <Badge variant="success" size="sm">
                  Comprado
                </Badge>
              )}
            </div>
            <p className="text-xs text-base-content/60">
              {item.quantity} {product.unit ?? "Un"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-base-content/40">Qtd</span>
                <Input
                  value={quantityDraft}
                  onChange={(event) => setQuantityDraft(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  onBlur={handleQuantityBlur}
                  placeholder={String(item.quantity)}
                  inputMode="decimal"
                  size="sm"
                  className="px-2 text-center tabular-nums"
                  style={{
                    width: `${Math.max(String(item.quantity).length, quantityDraft.length, 1) + 3}ch`,
                  }}
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-base-content/40">Preço</span>
                <Input
                  value={priceDraft}
                  onChange={(event) => setPriceDraft(event.target.value)}
                  onFocus={(event) => event.target.select()}
                  onBlur={handlePriceBlur}
                  placeholder={
                    item.price !== null && item.price !== undefined
                      ? item.price.toFixed(2).replace(".", ",")
                      : "0,00"
                  }
                  inputMode="decimal"
                  size="sm"
                  className="px-2 text-center tabular-nums"
                  style={{
                    width: `${Math.max(item.price !== null && item.price !== undefined ? item.price.toFixed(2).length : 4, priceDraft.length, 4) + 3}ch`,
                  }}
                />
              </div>
              {item.isPriceStale && (
                <Badge variant="warning" size="sm">
                  Antigo
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)}>
              Excluir
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
