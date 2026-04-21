import type { ReactElement } from "react";
import { Badge } from "../../../components/Badge/Badge";
import { Button } from "../../../components/Button/Button";
import { Card, CardBody } from "../../../components/Card/Card";
import type { InventoryProduct } from "../types";

interface ProductCardProps {
  product: InventoryProduct;
  onEdit: (product: InventoryProduct) => void;
  onAddToList: (product: InventoryProduct) => void;
  onRemove: (id: string) => void;
  onDecrease: (product: InventoryProduct) => void;
  onIncrease: (product: InventoryProduct) => void;
}

export const ProductCard = ({
  product,
  onEdit,
  onAddToList,
  onRemove,
  onDecrease,
  onIncrease,
}: ProductCardProps): ReactElement => {
  const isOut = product.quantity === 0;
  const isLow = product.quantity > 0 && product.quantity <= product.minStock;

  return (
    <Card
      className={`shadow-none ${isOut ? "border-error/50 bg-error/5" : isLow ? "border-warning/50 bg-warning/5" : "border-base-300"}`}
    >
      <CardBody className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium truncate">{product.name}</p>
              {product.unit && (
                <span className="text-xs text-base-content/60">({product.unit})</span>
              )}
            </div>
            <p className="text-xs text-base-content/60 mt-1">
              Min {product.minStock} {product.unit ?? "un"}
            </p>
          </div>

          <div className="flex items-center gap-1 flex-wrap justify-end">
            {isOut && (
              <Badge variant="error" size="sm">
                Zerado
              </Badge>
            )}
            {isLow && !isOut && (
              <Badge variant="warning" size="sm">
                Baixo
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDecrease(product)}
              disabled={product.quantity <= 0}
            >
              -
            </Button>
            <span className="w-10 text-center font-semibold tabular-nums">{product.quantity}</span>
            <Button variant="ghost" size="sm" onClick={() => onIncrease(product)}>
              +
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => onAddToList(product)}>
              Na lista
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(product)}>
              Editar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRemove(product.id)}>
              Excluir
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
