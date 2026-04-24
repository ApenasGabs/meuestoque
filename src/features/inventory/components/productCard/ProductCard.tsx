import type { ReactElement } from "react";
import { useRef } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Card, CardBody } from "../../../../components/Card/Card";
import type { InventoryProduct } from "../../types";
import { EditOutlined, ShoppingCartOutlined, DeleteOutlined } from "@ant-design/icons";

interface ProductCardProps {
  product: InventoryProduct;
  onEdit: (product: InventoryProduct) => void;
  onAddToList: (product: InventoryProduct) => void;
  onRemove: (id: string) => void;
  onConsume?: (product: InventoryProduct) => void;
  onOpenCustomConsume?: (product: InventoryProduct) => void;
  onCardClick?: (product: InventoryProduct) => void;
}

export const ProductCard = ({
  product,
  onEdit,
  onAddToList,
  onRemove,
  onConsume = () => undefined,
  onOpenCustomConsume = () => undefined,
  onCardClick,
}: ProductCardProps): ReactElement => {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

  const isOut = product.quantity === 0;
  const isLow = product.quantity > 0 && product.quantity <= product.minStock;
  const isPendingValidity = Boolean(product.needsValidity);

  const handleConsumePointerDown = (): void => {
    longPressTriggeredRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      onOpenCustomConsume(product);
    }, 500);
  };

  const clearLongPress = (): void => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  const handleConsumeClick = (): void => {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }

    onConsume(product);
  };

  return (
    <Card
      className={`shadow-none ${onCardClick ? "cursor-pointer" : ""} ${isPendingValidity ? "border-error/60 bg-error/5" : isOut ? "border-error/50 bg-error/5" : isLow ? "border-warning/50 bg-warning/5" : "border-base-300"}`}
      testId={`product-card-${product.id}`}
    >
      <CardBody
        className="p-2 overflow-x-auto"
        onClick={() => {
          if (onCardClick) {
            onCardClick(product);
          }
        }}
      >
        <div className="flex items-center justify-between whitespace-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-sm font-medium truncate max-w-44">{product.name}</p>
            {product.unit && <span className="text-xs text-base-content/60">({product.unit})</span>}
            <p className="text-xs text-base-content/60">
              Min {product.minStock} {product.unit ?? "un"}
            </p>
            {product.lastPurchaseDate && (
              <p className="text-xs text-base-content/60">
                Última compra: {new Date(product.lastPurchaseDate).toLocaleDateString("pt-BR")}
              </p>
            )}
            {isPendingValidity && (
              <Badge variant="error" size="sm">
                Pendente Validade
              </Badge>
            )}
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
            <span className="w-8 text-center font-semibold tabular-nums">{product.quantity}</span>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleConsumeClick}
              onMouseDown={(event) => {
                event.stopPropagation();
                handleConsumePointerDown();
              }}
              onMouseUp={(event) => {
                event.stopPropagation();
                clearLongPress();
              }}
              onMouseLeave={clearLongPress}
              onTouchStart={(event) => {
                event.stopPropagation();
                handleConsumePointerDown();
              }}
              onTouchEnd={(event) => {
                event.stopPropagation();
                clearLongPress();
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenCustomConsume(product);
              }}
              aria-label={`Consumir ${product.name}`}
            >
              Consumir
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => onAddToList(product)}
              aria-label={`Adicionar ${product.name} na lista`}
              onMouseDown={(event) => event.stopPropagation()}
              onClickCapture={(event) => event.stopPropagation()}
            >
              <ShoppingCartOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(product)}
              aria-label={`Editar ${product.name}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClickCapture={(event) => event.stopPropagation()}
            >
              <EditOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(product.id)}
              aria-label={`Remover ${product.name}`}
              onMouseDown={(event) => event.stopPropagation()}
              onClickCapture={(event) => event.stopPropagation()}
            >
              <DeleteOutlined />
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};
