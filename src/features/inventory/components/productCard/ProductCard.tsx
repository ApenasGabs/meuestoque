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
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium truncate max-w-40">{product.name}</p>
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
            <div className="flex items-center gap-2">
              {product.unit && <span className="text-xs text-base-content/60">{product.unit}</span>}
              {product.lastPurchaseDate && (
                <span className="text-xs text-base-content/40">
                  Última compra: {new Date(product.lastPurchaseDate).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-0.5">
            <span className="w-8 text-center font-semibold tabular-nums text-sm">{product.quantity}</span>

            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                handleConsumeClick();
              }}
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
              className="text-xs font-mono px-1.5"
            >
              -{product.portionSize ?? 1}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => { event.stopPropagation(); onAddToList(product); }}
              aria-label={`Adicionar ${product.name} na lista`}
            >
              <ShoppingCartOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => { event.stopPropagation(); onEdit(product); }}
              aria-label={`Editar ${product.name}`}
            >
              <EditOutlined />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => { event.stopPropagation(); onRemove(product.id); }}
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
