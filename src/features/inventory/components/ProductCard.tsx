import type { ReactElement } from "react";
import { Badge } from "../../../components/Badge/Badge";
import { Button } from "../../../components/Button/Button";
import { Card, CardBody } from "../../../components/Card/Card";
import type { InventoryProduct } from "../types";
import { ShoppingCartOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";

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
      <CardBody className="p-2 overflow-x-auto">
        <div className="flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate max-w-44">{product.name}</p>
            {product.unit && <span className="text-xs text-base-content/60">({product.unit})</span>}
            <p className="text-xs text-base-content/60">
              Min {product.minStock} {product.unit ?? "un"}
            </p>
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

          <div className="flex items-center ">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDecrease(product)}
              disabled={product.quantity <= 0}
              aria-label={`Diminuir quantidade de ${product.name}`}
            >
              -
            </Button>
            <span className="w-8 text-center font-semibold tabular-nums">{product.quantity}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onIncrease(product)}
              aria-label={`Aumentar quantidade de ${product.name}`}
            >
              +
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddToList(product)}
              aria-label={`Adicionar ${product.name} na lista`}
            >
              <ShoppingCartOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(product)}
              aria-label={`Editar ${product.name}`}
            >
              <EditOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(product.id)}
              aria-label={`Remover ${product.name}`}
            >
              <DeleteOutlined />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
