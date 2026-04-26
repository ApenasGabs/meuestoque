import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Card, CardBody } from "../../../../components/Card/Card";
import { Drawer } from "../../../../components/Drawer/Drawer";
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
  onViewHistory?: (product: InventoryProduct) => void;
}

/**
 * Interactive card component for inventory products.
 * 
 * Features:
 * - Quick consumption button (-portion) with long-press for custom amount
 * - Contextual badges: Low stock, Out of stock, Expiring soon, Auto-consume enabled
 * - Stock level progress bar based on min_stock ratio
 * - Auto-consumption runout prediction display
 * - Pack/Box conversion display (e.g. "X units (Y packs)")
 * - Action buttons: Edit, Delete, Add to Cart, View History
 * - Swipe/Mobile-friendly long-press interactions
 * 
 * @param props.product - The product data to display
 * @param props.onEdit - Callback to open edit form
 * @param props.onAddToList - Callback to add item to shopping list
 * @param props.onRemove - Callback to initiate deletion
 * @param props.onConsume - Callback for quick consumption (click)
 * @param props.onOpenCustomConsume - Callback for custom consumption (long-press)
 */
export const ProductCard = ({
  product,
  onEdit,
  onAddToList,
  onRemove,
  onConsume = () => undefined,
  onOpenCustomConsume = () => undefined,
  onCardClick,
  onViewHistory,
}: ProductCardProps): ReactElement => {
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  const isOut = product.quantity === 0;
  const isLow = product.quantity > 0 && product.quantity <= product.minStock;
  const isPendingValidity = Boolean(product.needsValidity);

  // Calculate expiry proximity for badge display
  const expiryInfo = (() => {
    if (!product.validityDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(product.validityDate + "T00:00:00");
    const diffMs = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays <= 0) return { label: "Vencido!", variant: "error" as const };
    if (diffDays <= 7) return { label: `Vence em ${diffDays}d`, variant: "warning" as const };
    return null;
  })();

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

  const handleConfirmDelete = (): void => {
    setConfirmDeleteOpen(false);
    onRemove(product.id);
  };

  // Auto-consumption info
  const hasAutoConsume = (product.consumeValue ?? 0) > 0;
  const autoConsumeLabel = (() => {
    if (!hasAutoConsume) return null;
    const val = product.consumeValue ?? 0;
    const freq = product.consumeFrequency ?? "daily";
    const suffix = freq === "daily" ? "/dia" : freq === "weekly" ? "/sem" : "/mês";
    return `⏰ -${val}${suffix}`;
  })();

  // Runout prediction
  const runoutDays = (() => {
    if (!hasAutoConsume || product.quantity <= 0) return null;
    const val = product.consumeValue ?? 0;
    const freq = product.consumeFrequency ?? "daily";
    const ps = product.portionSize ?? 1;
    const daily = freq === "daily" ? val * ps : freq === "weekly" ? (val * ps) / 7 : (val * ps) / 30;
    if (daily <= 0) return null;
    return Math.floor(product.quantity / daily);
  })();

  // Progress bar percentage (quantity vs minStock)
  const stockPercent = product.minStock > 0
    ? Math.min(100, Math.round((product.quantity / product.minStock) * 100))
    : product.quantity > 0 ? 100 : 0;
  const progressColor = stockPercent <= 0
    ? "bg-error"
    : stockPercent <= 100
      ? "bg-warning"
      : "bg-success";

  return (
    <Card
      className={`shadow-none ${onCardClick ? "cursor-pointer" : ""} ${isPendingValidity ? "border-error/60 bg-error/5" : isOut ? "border-error/50 bg-error/5" : isLow ? "border-warning/50 bg-warning/5" : expiryInfo?.variant === "error" ? "border-error/50 bg-error/5" : expiryInfo?.variant === "warning" ? "border-warning/50 bg-warning/5" : "border-base-300"}`}
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5 min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-sm font-medium truncate max-w-[120px] xs:max-w-40">{product.name}</p>
              <div className="flex flex-wrap gap-1">
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
                {expiryInfo && !isPendingValidity && (
                  <Badge variant={expiryInfo.variant} size="sm">
                    {expiryInfo.label}
                  </Badge>
                )}
                {autoConsumeLabel && (
                  <Badge variant="info" size="sm">
                    {autoConsumeLabel}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {product.unit && (
                <span className="text-xs text-base-content/60">
                  {product.unit}
                  {product.packLabel && product.packSize && ` (${(product.quantity / product.packSize).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${product.packLabel})`}
                </span>
              )}
              {product.lastPurchaseDate && (
                <span className="text-xs text-base-content/40">
                  {new Date(product.lastPurchaseDate).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            {/* Stock level progress bar */}
            {product.minStock > 0 && !isPendingValidity && (
              <div className="mt-1 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-base-300/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressColor}`}
                    style={{ width: `${Math.min(stockPercent, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-base-content/50 flex-shrink-0">
                  {stockPercent}%
                </span>
              </div>
            )}

            {/* Runout prediction (Feature #13) */}
            {runoutDays !== null && !isPendingValidity && (
              <p className={`text-[10px] mt-0.5 ${
                runoutDays <= 3 ? "text-error font-medium" : runoutDays <= 7 ? "text-warning" : "text-base-content/50"
              }`}>
                {runoutDays <= 0
                  ? "⚠️ Estoque acabou! Reponha agora."
                  : runoutDays <= 3
                    ? `⚡ Dura ~${runoutDays}d com consumo auto.`
                    : `📊 Dura ~${runoutDays}d com consumo auto.`}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-1 border-t border-base-200 pt-2 sm:border-t-0 sm:pt-0">
            <div className="flex items-center bg-base-200/50 rounded-lg px-2 mr-1">
              <span className="w-8 text-center font-bold tabular-nums text-sm">{product.quantity}</span>
            </div>

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
                event.preventDefault();
                clearLongPress();
                if (!longPressTriggeredRef.current) {
                  onConsume(product);
                }
                longPressTriggeredRef.current = false;
              }}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenCustomConsume(product);
              }}
              aria-label={`Consumir ${product.name}`}
              className="text-xs font-mono px-2 bg-base-200 hover:bg-base-300 border-none min-h-8 h-8"
            >
              -{product.portionSize ?? 1}
            </Button>

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => { event.stopPropagation(); onAddToList(product); }}
                aria-label={`Adicionar ${product.name} na lista`}
                className="min-h-8 h-8 w-8 p-0"
              >
                <ShoppingCartOutlined />
              </Button>
              {onViewHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => { event.stopPropagation(); onViewHistory(product); }}
                  aria-label={`Histórico de ${product.name}`}
                  className="min-h-8 h-8 w-8 p-0 text-info/70 hover:text-info"
                >
                  📊
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => { event.stopPropagation(); onEdit(product); }}
                aria-label={`Editar ${product.name}`}
                className="min-h-8 h-8 w-8 p-0"
              >
                <EditOutlined />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => { event.stopPropagation(); setConfirmDeleteOpen(true); }}
                aria-label={`Remover ${product.name}`}
                className="min-h-8 h-8 w-8 p-0 text-error/70 hover:text-error hover:bg-error/10"
              >
                <DeleteOutlined />
              </Button>
            </div>
          </div>
        </div>
      </CardBody>

      {confirmDeleteOpen && (
        <Drawer
          open={confirmDeleteOpen}
          onClose={() => setConfirmDeleteOpen(false)}
          title="Remover produto"
          subtitle={product.name}
        >
          <div className="space-y-4">
            <p className="text-sm text-base-content/80">
              Tem certeza que deseja remover <strong>{product.name}</strong> do estoque?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onClick={() => setConfirmDeleteOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="flex-1 bg-error text-error-content hover:bg-error/80"
                onClick={handleConfirmDelete}
              >
                Remover
              </Button>
            </div>
          </div>
        </Drawer>
      )}
    </Card>
  );
};
