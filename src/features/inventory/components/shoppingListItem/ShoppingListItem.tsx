import { memo, useMemo, useState } from "react";
import type { ReactElement } from "react";
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
  onUpdateUnitPrice?: (id: string, value: number | null) => void;
  onUpdateQuantity?: (id: string, value: number) => void;
  onUpdateValidityDate?: (id: string, date: string | null, naoAplica?: boolean) => void;
}

/**
 * Individual item card for the shopping list.
 * 
 * Features:
 * - Optimistic toggle for purchased state
 * - Dual price input: Total price or Unit price (auto-converts)
 * - Quantity adjustment with unit display
 * - Pack/Box conversion hints
 * - Validity date input (appears when item is checked)
 * - Visual indicator for stale prices (older than 30 days)
 * 
 * @param props.item - The shopping list item record
 * @param props.product - The associated product record for unit/pack info
 * @param props.onToggle - Callback to toggle "purchased" state
 * @param props.onRemove - Callback to remove item from list
 * @param props.onUpdatePrice - Callback to update total price
 * @param props.onUpdateUnitPrice - Callback to update price per unit
 * @param props.onUpdateQuantity - Callback to update item quantity
 * @param props.onUpdateValidityDate - Callback to update item validity
 */
export const ShoppingListItem = memo(function ShoppingListItem({
  item,
  product,
  onToggle,
  onRemove,
  onUpdatePrice,
  onUpdateUnitPrice,
  onUpdateQuantity,
  onUpdateValidityDate,
}: ShoppingListItemProps): ReactElement {
  // ── Price mode: 'total' = user enters full price; 'unit' = user enters R$/unit ──
  const [priceMode, setPriceMode] = useState<"total" | "unit">(
    item.pricePerUnit != null ? "unit" : "total",
  );

  // ── Quantity draft ──
  const [prevQuantity, setPrevQuantity] = useState(item.quantity);
  const [quantityDraft, setQuantityDraft] = useState(String(item.quantity));
  if (item.quantity !== prevQuantity) {
    setPrevQuantity(item.quantity);
    setQuantityDraft(String(item.quantity));
  }

  // ── Price draft — source depends on current mode ──
  const priceSource =
    priceMode === "unit" && item.pricePerUnit != null
      ? item.pricePerUnit
      : (item.price ?? null);

  const [prevPriceSource, setPrevPriceSource] = useState(priceSource);
  const [priceDraft, setPriceDraft] = useState(
    priceSource != null ? priceSource.toFixed(2).replace(".", ",") : "",
  );
  if (priceSource !== prevPriceSource) {
    setPrevPriceSource(priceSource);
    setPriceDraft(priceSource != null ? priceSource.toFixed(2).replace(".", ",") : "");
  }

  // ── Calculated total when in unit mode ──
  const calculatedTotal = useMemo(() => {
    if (priceMode !== "unit") return null;
    const u = Number.parseFloat(priceDraft.replace(",", "."));
    return Number.isFinite(u) && u > 0 ? Math.round(u * item.quantity * 100) / 100 : null;
  }, [priceMode, priceDraft, item.quantity]);

  // ── Toggle mode ──
  const togglePriceMode = (): void => {
    const next = priceMode === "total" ? "unit" : "total";
    setPriceMode(next);

    if (next === "unit") {
      // If switching to unit mode and we have a total, estimate per-unit
      const total = Number.parseFloat(priceDraft.replace(",", "."));
      if (Number.isFinite(total) && total > 0 && item.quantity > 0) {
        setPriceDraft((total / item.quantity).toFixed(2).replace(".", ","));
      } else {
        setPriceDraft("");
      }
    } else {
      // If switching to total mode, show the computed total
      if (calculatedTotal != null) {
        setPriceDraft(calculatedTotal.toFixed(2).replace(".", ","));
      } else {
        setPriceDraft(item.price != null ? item.price.toFixed(2).replace(".", ",") : "");
      }
    }
  };

  // ── Handlers ──
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
    const raw = priceDraft.trim();
    if (raw === "") {
      if (priceMode === "unit") onUpdateUnitPrice?.(item.id, null);
      else onUpdatePrice?.(item.id, null);
      return;
    }

    const parsed = Number.parseFloat(raw.replace(",", "."));
    if (Number.isNaN(parsed)) {
      // Reset draft to current stored value
      setPriceDraft(priceSource != null ? priceSource.toFixed(2).replace(".", ",") : "");
      return;
    }

    if (priceMode === "unit") {
      onUpdateUnitPrice?.(item.id, parsed);
    } else {
      onUpdatePrice?.(item.id, parsed);
    }
  };

  const baseUnit = product.unit ?? "Un";
  const displayUnit = product.packLabel || baseUnit;
  const hasPack = Boolean(product.packLabel && product.packSize);

  return (
    <Card className={`shadow-none ${item.checked ? "opacity-70 border-base-300" : "border-base-300"}`}>
      <CardBody className="p-3">
        <div className="flex items-start gap-3">
          <Checkbox
            checked={item.checked}
            onChange={() => onToggle(item.id)}
            aria-label={`Marcar ${product.name}`}
          />

          <div className="flex-1 min-w-0">
            {/* Product name + badge */}
            <div className="flex items-center gap-2 flex-wrap">
              <p
                className={`text-sm font-medium ${item.checked ? "line-through text-base-content/50" : ""}`}
              >
                {product.name}
              </p>
              {item.checked && (
                <Badge variant="success" size="sm">
                  No carrinho
                </Badge>
              )}
            </div>

            {/* Controls */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              {/* Quantity */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] uppercase font-bold text-base-content/40">Qtd</span>
                <Input
                  value={quantityDraft}
                  onChange={(e) => setQuantityDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleQuantityBlur}
                  inputMode="decimal"
                  size="sm"
                  className="px-2 text-center tabular-nums"
                  style={{ width: `${Math.max(quantityDraft.length, 2) + 2}ch` }}
                />
                <span className="text-[10px] uppercase font-bold text-base-content/40">{displayUnit}</span>
                {hasPack && (
                  <span className="text-[10px] text-base-content/40 ml-1">
                    (rende {product.packSize} {baseUnit})
                  </span>
                )}
              </div>

              {/* Price input + mode toggle */}
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={togglePriceMode}
                  title={
                    priceMode === "total"
                      ? `Mudar para preço por ${displayUnit}`
                      : "Mudar para preço total"
                  }
                  className="text-[10px] uppercase font-bold text-base-content/40 hover:text-primary transition-colors cursor-pointer select-none"
                >
                  {priceMode === "total" ? "R$ total" : `R$/${displayUnit}`}
                </button>
                <Input
                  value={priceDraft}
                  onChange={(e) => setPriceDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handlePriceBlur}
                  placeholder="0,00"
                  inputMode="decimal"
                  size="sm"
                  className="px-2 text-center tabular-nums"
                  style={{ width: `${Math.max(priceDraft.length, 4) + 2}ch` }}
                />
              </div>

              {/* Calculated total hint in unit mode */}
              {priceMode === "unit" && calculatedTotal != null && (
                <span className="text-xs font-bold text-primary tabular-nums">
                  = R$ {calculatedTotal.toFixed(2).replace(".", ",")}
                </span>
              )}

              {item.isPriceStale && (
                <Badge variant="warning" size="sm">
                  Antigo
                </Badge>
              )}
            </div>

            {/* Validity Date Input when checked */}
            {item.checked && (
              <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase font-bold text-base-content/50">Validade:</span>
                  <Input
                    type="date"
                    size="sm"
                    value={item.validityDate || ""}
                    onChange={(e) => onUpdateValidityDate?.(item.id, e.target.value || null, item.naoAplicaValidade)}
                    className="max-w-[150px] text-xs h-7"
                    disabled={item.naoAplicaValidade}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer mt-1 sm:mt-0">
                  <Checkbox 
                    checked={item.naoAplicaValidade || false}
                    onChange={(e) => onUpdateValidityDate?.(item.id, item.validityDate || null, e.target.checked)}
                  />
                  <span className="text-xs text-base-content/80">Não se aplica</span>
                </label>
              </div>
            )}
          </div>

          <Button variant="ghost" size="sm" onClick={() => onRemove(item.id)}>
            Excluir
          </Button>
        </div>
      </CardBody>
    </Card>
  );
});
