import type { ReactElement } from "react";
import { useEffect, useState } from "react";
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
  onBuy: (id: string) => void;
  onUpdatePrice?: (id: string, value: number | null) => void;
}

export const ShoppingListItem = ({
  item,
  product,
  onToggle,
  onRemove,
  onBuy,
  onUpdatePrice,
}: ShoppingListItemProps): ReactElement => {
  const [priceDraft, setPriceDraft] = useState<string>(
    item.price !== null && item.price !== undefined ? item.price.toFixed(2).replace(".", ",") : "",
  );

  useEffect(() => {
    setPriceDraft(
      item.price !== null && item.price !== undefined
        ? item.price.toFixed(2).replace(".", ",")
        : "",
    );
  }, [item.price]);

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
              {item.quantity} {product.unit ?? "un"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Input
                value={priceDraft}
                onChange={(event) => setPriceDraft(event.target.value)}
                onBlur={handlePriceBlur}
                placeholder="Preço"
                inputMode="decimal"
                size="sm"
                className="w-28"
              />
              {item.isPriceStale && (
                <Badge variant="warning" size="sm">
                  Preço &gt;30 dias
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
            {!item.checked && (
              <Button variant="ghost" size="sm" onClick={() => onBuy(item.id)}>
                Comprar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)}>
              Excluir
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
