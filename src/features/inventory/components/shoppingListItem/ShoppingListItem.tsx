import { memo, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Button } from "../../../../components/Button/Button";
import { Card, CardBody } from "../../../../components/Card/Card";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";
import { Input } from "../../../../components/Input/Input";
import { useBulkStore } from "../../../../stores/bulkStore";
import type { InventoryProduct, InventoryShoppingListItem } from "../../types";

import { UNITS } from "../../../../types/inventory.types";
import type { Unit } from "../../../../types/inventory.types";

interface ShoppingListItemProps {
  item: InventoryShoppingListItem;
  product: InventoryProduct;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onUpdatePrice?: (id: string, value: number | null) => void;
  onUpdateUnitPrice?: (id: string, value: number | null) => void;
  onUpdateQuantity?: (id: string, value: number) => void;
  onUpdateUnit?: (id: string, unit: Unit) => void;
  onUpdateValidityDate?: (id: string, date: string | null, naoAplica?: boolean) => void;
  onUpdatePackSize?: (id: string, packLabel: string | null, packSize: number | null, packUnit: string | null) => void;
}

/**
 * Individual item card for the shopping list.
 * 
 * Features:
 * - Optimistic toggle for purchased state
 * - Dual price input: Total price or Unit price (auto-converts)
 * - Quantity adjustment with unit display
 * - Pack/Box conversion: × [size] [unit] = total (inline)
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
 * @param props.onUpdatePackSize - Callback to update pack size info
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
  onUpdateUnit,
  onUpdateValidityDate,
  onUpdatePackSize,
}: ShoppingListItemProps): ReactElement {
  // ── Bulk mode plumbing for the shopping list (Spec Epic 1) ──
  const { isBulkMode, scope, isSelected, toggleItemSelection, enterBulkMode } = useBulkStore();
  const listBulk = isBulkMode && scope === "shopping_list";
  const selected = isSelected(item.id);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef<boolean>(false);

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

  // ── Pack size draft (embalagem × rendimento) ──
  const [packSizeDraft, setPackSizeDraft] = useState(
    item.packSize != null ? String(item.packSize) : "",
  );
  const [packUnitDraft, setPackUnitDraft] = useState<Unit>(
    (item.packUnit as Unit) ?? baseUnit,
  );
  const [showPackFields, setShowPackFields] = useState(
    item.packSize != null && item.packSize > 0,
  );

  // ── Calculated stock quantity (qty × pack size) ──
  const calculatedStockQty = useMemo(() => {
    const packNum = Number.parseFloat(packSizeDraft.replace(",", "."));
    if (!showPackFields || !Number.isFinite(packNum) || packNum <= 0) return null;
    return Math.round(item.quantity * packNum * 1000) / 1000;
  }, [showPackFields, packSizeDraft, item.quantity]);

  const handlePackSizeBlur = (): void => {
    if (!onUpdatePackSize) return;
    const packNum = Number.parseFloat(packSizeDraft.replace(",", "."));
    const validPack = Number.isFinite(packNum) && packNum > 0 ? packNum : null;
    // Use the item quantity unit as packLabel when no dedicated label
    const packLabel = validPack ? "pacote" : null;
    onUpdatePackSize(item.id, packLabel, validPack, validPack ? packUnitDraft : null);
  };

  const handlePackUnitChange = (unit: Unit): void => {
    setPackUnitDraft(unit);
    if (!onUpdatePackSize) return;
    const packNum = Number.parseFloat(packSizeDraft.replace(",", "."));
    const validPack = Number.isFinite(packNum) && packNum > 0 ? packNum : null;
    if (validPack) {
      onUpdatePackSize(item.id, "pacote", validPack, unit);
    }
  };

  const handleLongPressStart = (): void => {
    longPressTriggeredRef.current = false;
    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      if (!isBulkMode) {
        enterBulkMode("shopping_list", item.id);
      }
    }, 500);
  };
  const handleLongPressEnd = (): void => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  };

  return (
    <Card
      className={`shadow-none ${selected ? "border-primary bg-primary/5" : item.checked ? "opacity-70 border-base-300" : "border-base-300"}`}
      onPointerDown={handleLongPressStart}
      onPointerUp={handleLongPressEnd}
      onPointerCancel={handleLongPressEnd}
      onContextMenu={(e: React.MouseEvent) => {
        e.preventDefault();
        if (!isBulkMode) {
          enterBulkMode("shopping_list", item.id);
        }
      }}
    >
      <CardBody
        className="p-3"
        onClick={() => {
          if (longPressTriggeredRef.current) {
            longPressTriggeredRef.current = false;
            return;
          }
          if (listBulk) {
            toggleItemSelection(item.id);
          }
        }}
      >
        <div className="flex items-start gap-3">
          {listBulk ? (
            <Checkbox
              checked={selected}
              onChange={() => toggleItemSelection(item.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Selecionar ${product.name}`}
            />
          ) : (
            <Checkbox
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              aria-label={`Marcar ${product.name}`}
              data-testid={`shopping-item-checkbox-${product.name.toLowerCase().replace(/\s+/g, "-")}`}
            />
          )}

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
              {/* Visual chip showing pre-set validity (Epic 2 / Spec §4) */}
              {item.naoAplicaValidade && (
                <Badge variant="info" size="sm">
                  ♾️ Sem validade
                </Badge>
              )}
              {!item.naoAplicaValidade && item.validityDate && (
                <Badge variant="info" size="sm">
                  📅 {new Date(item.validityDate + "T00:00:00").toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>

            {/* Quantity + Pack size + Price + Validity row */}
            <div className="mt-2 flex items-center gap-x-2 overflow-x-auto scrollbar-hide pb-1 w-full">
              {/* Quantity */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[10px] uppercase font-bold text-base-content/40">Qtd</span>
                <Input
                  value={quantityDraft}
                  onChange={(e) => setQuantityDraft(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onBlur={handleQuantityBlur}
                  inputMode="decimal"
                  size="sm"
                  className="px-2 text-center tabular-nums h-6 min-h-6"
                  style={{ width: `${Math.max(quantityDraft.length, 2) + 2}ch` }}
                  data-testid="shopping-item-quantity"
                />
                <select
                  className="select select-bordered select-xs h-6 min-h-6 px-1 py-0 text-[10px] uppercase font-bold text-base-content/70 cursor-pointer"
                  value={baseUnit}
                  onChange={(event) => {
                    event.stopPropagation();
                    onUpdateUnit?.(item.id, event.target.value as Unit);
                  }}
                  onClick={(event) => event.stopPropagation()}
                  aria-label="Alterar unidade"
                  title="Alterar unidade"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                  {baseUnit && !UNITS.includes(baseUnit as Unit) && (
                    <option value={baseUnit}>{baseUnit}</option>
                  )}
                </select>
                {hasPack && (
                  <span className="text-[10px] text-base-content/40 ml-1">
                    (rende {product.packSize} {baseUnit})
                  </span>
                )}
              </div>

              {/* Pack size toggle button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowPackFields((prev) => !prev); }}
                title={showPackFields ? "Ocultar rendimento" : "Informar rendimento por embalagem"}
                className={`btn btn-xs px-1.5 min-h-0 h-6 rounded uppercase font-bold text-[10px] transition-colors shrink-0 ${
                  showPackFields ? "btn-active text-primary bg-primary/10" : "btn-ghost text-base-content/60"
                }`}
              >
                📦
              </button>

              {/* Pack size inline fields */}
              {showPackFields && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] uppercase font-bold text-base-content/40">×</span>
                  <Input
                    value={packSizeDraft}
                    onChange={(e) => setPackSizeDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={handlePackSizeBlur}
                    placeholder="0"
                    inputMode="decimal"
                    size="sm"
                    className="px-2 text-center tabular-nums h-6 min-h-6"
                    style={{ width: `${Math.max(packSizeDraft.length, 2) + 2}ch` }}
                    aria-label="Rendimento por embalagem"
                  />
                  <select
                    className="select select-bordered select-xs h-6 min-h-6 px-1 py-0 text-[10px] uppercase font-bold text-base-content/70 cursor-pointer"
                    value={packUnitDraft}
                    onChange={(e) => { e.stopPropagation(); handlePackUnitChange(e.target.value as Unit); }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Unidade do rendimento"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                  {calculatedStockQty !== null && (
                    <span className="text-[10px] font-bold text-primary tabular-nums ml-1 whitespace-nowrap">
                      = {calculatedStockQty} {packUnitDraft}
                    </span>
                  )}
                </div>
              )}

              {/* Price input + mode toggle */}
              <div className="flex items-center gap-1 shrink-0 ml-1">
                <button
                  type="button"
                  onClick={togglePriceMode}
                  title={
                    priceMode === "total"
                      ? `Mudar para preço por ${displayUnit}`
                      : "Mudar para preço total"
                  }
                  className="btn btn-xs btn-ghost px-1.5 min-h-0 h-6 rounded text-[10px] uppercase font-bold text-base-content/60"
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
                  className="px-2 text-center tabular-nums h-6 min-h-6"
                  style={{ width: `${Math.max(priceDraft.length, 4) + 2}ch` }}
                  data-testid="shopping-item-price"
                />
                {/* Calculated total hint in unit mode */}
                {priceMode === "unit" && calculatedTotal != null && (
                  <span className="text-[10px] font-bold text-primary tabular-nums ml-1 whitespace-nowrap">
                    = R$ {calculatedTotal.toFixed(2).replace(".", ",")}
                  </span>
                )}
                {item.isPriceStale && (
                  <Badge variant="warning" size="sm" className="ml-1 text-[10px] h-5 min-h-0">
                    Antigo
                  </Badge>
                )}
              </div>

              {/* Validity fields (inline when checked) */}
              {item.checked && (
                <>
                  <div className="flex items-center gap-1 shrink-0 ml-2 border-l border-base-300 pl-3">
                    <span className="text-[10px] uppercase font-bold text-base-content/50">Val:</span>
                    <Input
                      type="date"
                      size="sm"
                      value={item.validityDate || ""}
                      onChange={(e) => onUpdateValidityDate?.(item.id, e.target.value || null, item.naoAplicaValidade)}
                      className="w-[110px] px-1 text-[10px] h-6 min-h-6"
                      disabled={item.naoAplicaValidade}
                    />
                  </div>
                  <label className="flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap">
                    <Checkbox 
                      className="checkbox-xs shrink-0"
                      checked={item.naoAplicaValidade || false}
                      onChange={(e) => onUpdateValidityDate?.(item.id, item.validityDate || null, e.target.checked)}
                    />
                    <span className="text-[10px] uppercase font-bold text-base-content/60 whitespace-nowrap">N/A</span>
                  </label>
                </>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onRemove(item.id)}
            data-testid="remove-item-button"
          >
            Excluir
          </Button>
        </div>
      </CardBody>
    </Card>
  );
});
