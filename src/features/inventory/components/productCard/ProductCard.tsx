import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Card, CardBody } from "../../../../components/Card/Card";
import { Drawer } from "../../../../components/Drawer/Drawer";
import type { InventoryProduct } from "../../types";
import { EditOutlined, ShoppingCartOutlined, DeleteOutlined } from "@ant-design/icons";
import { useBulkStore } from "../../../../stores/bulkStore";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";

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
  const cardLongPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardLongPressTriggeredRef = useRef<boolean>(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState<boolean>(false);

  const { isBulkMode, isSelected, toggleItemSelection, enterBulkMode } = useBulkStore();
  const selected = isSelected(product.id);

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
    const daily =
      freq === "daily" ? val * ps : freq === "weekly" ? (val * ps) / 7 : (val * ps) / 30;
    if (daily <= 0) return null;
    return Math.floor(product.quantity / daily);
  })();

  // Progress bar percentage (quantity vs minStock)
  const stockPercent =
    product.minStock > 0
      ? Math.min(100, Math.round((product.quantity / product.minStock) * 100))
      : product.quantity > 0
        ? 100
        : 0;
  const progressColor =
    stockPercent <= 0 ? "bg-error" : stockPercent <= 100 ? "bg-warning" : "bg-success";

  return (
    <Card
      className={`shadow-none ${onCardClick || isBulkMode ? "cursor-pointer" : ""} ${selected ? "border-primary bg-primary/5" : isPendingValidity ? "border-error/60 bg-error/5" : isOut ? "border-error/50 bg-error/5" : isLow ? "border-warning/50 bg-warning/5" : expiryInfo?.variant === "error" ? "border-error/50 bg-error/5" : expiryInfo?.variant === "warning" ? "border-warning/50 bg-warning/5" : "border-base-300"}`}
      testId={`product-card-${product.id}`}
    >
      <CardBody
        className="p-1.5 overflow-hidden"
        onClick={() => {
          if (cardLongPressTriggeredRef.current) {
            cardLongPressTriggeredRef.current = false;
            return;
          }
          if (isBulkMode) {
            toggleItemSelection(product.id);
          } else if (onCardClick) {
            onCardClick(product);
          }
        }}
        onPointerDown={() => {
          cardLongPressTriggeredRef.current = false;
          cardLongPressTimeoutRef.current = setTimeout(() => {
            cardLongPressTriggeredRef.current = true;
            if (!isBulkMode) {
              enterBulkMode("inventory", product.id);
            }
          }, 500);
        }}
        onPointerUp={() => {
          if (cardLongPressTimeoutRef.current) clearTimeout(cardLongPressTimeoutRef.current);
        }}
        onPointerCancel={() => {
          if (cardLongPressTimeoutRef.current) clearTimeout(cardLongPressTimeoutRef.current);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!isBulkMode) {
            enterBulkMode("inventory", product.id);
          }
        }}
      >
        <div className="flex flex-col gap-1.5">
          {/* Row 1: Name and Status Badges */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              {isBulkMode && (
                <Checkbox
                  checked={selected}
                  onChange={() => toggleItemSelection(product.id)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              <p className="text-sm font-bold truncate" title={product.name}>
                {product.name}
              </p>
            </div>
            <div className="flex flex-wrap gap-1 justify-end shrink-0">
              {isPendingValidity && (
                <Badge variant="error" size="sm">
                  Validade?
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
            </div>
          </div>

          {/* Row 2: Progress Bar with Percentage in Front */}
          {product.minStock > 0 && !isPendingValidity && (
            <div className="w-full relative h-3 flex items-center justify-center">
              {/* Thin Progress Bar behind */}
              <div className="w-full h-1 bg-base-300/30 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                  style={{ width: `${Math.min(stockPercent, 100)}%` }}
                />
              </div>

              {/* Percentage text in front */}
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums opacity-40 select-none pointer-events-none">
                {stockPercent}%
              </span>
            </div>
          )}

          {/* Row 3: Quantity, Unit, Consume Button and Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              {/* Quantity Indicator */}
              <div className="flex items-center justify-center bg-base-200/80 rounded px-1.5 py-0.5 min-w-[2.2rem] h-7 border border-base-300/50">
                <span className="text-sm font-bold tabular-nums leading-none">
                  {product.quantity}
                </span>
              </div>

              {/* Unit */}
              <span className="text-sm font-medium text-base-content/60 uppercase tracking-tighter">
                {product.unit ?? "Un"}
              </span>

              {/* Consume Button */}
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
                  longPressTriggeredRef.current = false;
                  clearLongPress();
                  onConsume(product);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onOpenCustomConsume(product);
                }}
                aria-label={`Consumir ${product.name}`}
                className="h-7 min-h-7 px-1.5 bg-base-200 hover:bg-base-300 border-none text-[10px] font-bold font-mono"
              >
                -{product.portionSize ?? 1}
              </Button>
            </div>

            {/* Icons Actions: 🛒 📊 ✏️ 🗑️ */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onAddToList(product);
                }}
                aria-label={`Adicionar ${product.name} na lista`}
                className="h-8 w-8 min-h-8 p-0"
                title="Adicionar na lista"
              >
                <ShoppingCartOutlined className="text-base" />
              </Button>
              {onViewHistory && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(event) => {
                    event.stopPropagation();
                    onViewHistory(product);
                  }}
                  aria-label={`Histórico de ${product.name}`}
                  className="h-8 w-8 min-h-8 p-0 opacity-70 hover:opacity-100"
                  title="Histórico de consumo"
                >
                  <span className="text-base">📊</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit(product);
                }}
                aria-label={`Editar ${product.name}`}
                className="h-8 w-8 min-h-8 p-0 opacity-70 hover:opacity-100"
                title="Editar"
              >
                <EditOutlined className="text-base" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirmDeleteOpen(true);
                }}
                aria-label={`Remover ${product.name}`}
                className="h-8 w-8 min-h-8 p-0 text-error/60 hover:text-error hover:bg-error/10"
                title="Remover"
              >
                <DeleteOutlined className="text-base" />
              </Button>
            </div>
          </div>

          {/* Optional: Auto-consume mini info if exists, very subtle */}
          {autoConsumeLabel && (
            <div className="flex items-center gap-1 opacity-40 text-[9px] -mt-1">
              <span>{autoConsumeLabel}</span>
              {runoutDays !== null && (
                <span className={runoutDays <= 3 ? "text-error font-bold" : ""}>
                  · dura ~{runoutDays}d
                </span>
              )}
            </div>
          )}
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
              Tem certeza que deseja remover <strong>{product.name}</strong> do estoque? Esta ação
              não pode ser desfeita.
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
