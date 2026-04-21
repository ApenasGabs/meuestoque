import type { ReactElement } from "react";
import { Badge } from "../../../components/Badge/Badge";
import { Button } from "../../../components/Button/Button";
import { Card, CardBody } from "../../../components/Card/Card";
import { Checkbox } from "../../../components/Checkbox/Checkbox";
import type { InventoryProduct, ShoppingListItem as ShoppingListItemType } from "../types";

interface ShoppingListItemProps {
  item: ShoppingListItemType;
  product: InventoryProduct;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onDecrease: (id: string) => void;
  onIncrease: (id: string) => void;
  onBuy: (id: string) => void;
}

export const ShoppingListItem = ({
  item,
  product,
  onToggle,
  onRemove,
  onDecrease,
  onIncrease,
  onBuy,
}: ShoppingListItemProps): ReactElement => {
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
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDecrease(item.id)}
              disabled={item.quantity <= 1}
            >
              -
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums">{item.quantity}</span>
            <Button variant="ghost" size="sm" onClick={() => onIncrease(item.id)}>
              +
            </Button>
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
