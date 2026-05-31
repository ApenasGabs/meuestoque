import { memo, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Card, CardBody } from "../../../../components/Card/Card";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";
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
        className="p-2 sm:p-3"
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
        {/* Linha 1: Checkbox + Nome + Badge + Lixeira */}
        <div className="flex items-center gap-2">
          {listBulk ? (
            <Checkbox
              checked={selected}
              onChange={() => toggleItemSelection(item.id)}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Selecionar ${product.name}`}
              className="shrink-0"
            />
          ) : (
            <Checkbox
              checked={item.checked}
              onChange={() => onToggle(item.id)}
              aria-label={`Marcar ${product.name}`}
              data-testid={`shopping-item-checkbox-${product.name.toLowerCase().replace(/\s+/g, "-")}`}
              className="shrink-0"
            />
          )}

          <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-sm font-medium truncate max-w-[200px] sm:max-w-none ${item.checked ? "line-through text-base-content/50" : ""}`}
            >
              {product.name}
            </span>
            {item.checked && (
              <Badge variant="success" size="sm" className="shrink-0 text-[10px] h-5">
                No carrinho
              </Badge>
            )}
          </div>

          {/* Botão lixeira compacto */}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            data-testid="remove-item-button"
            className="btn btn-ghost btn-xs p-1 min-h-0 h-6 w-6 shrink-0"
            title="Excluir"
          >
            <svg className="w-4 h-4 text-base-content/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Linha 2: Barra segmentada de controles */}
        <div className="flex items-center border border-base-300 rounded-lg overflow-hidden h-8 mt-2 ml-6 sm:ml-7">
          {/* Qtd + unidade */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-base-300 shrink-0">
            <input
              value={quantityDraft}
              onChange={(e) => setQuantityDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={handleQuantityBlur}
              inputMode="decimal"
              className="w-8 text-center text-sm bg-transparent outline-none tabular-nums"
              data-testid="shopping-item-quantity"
            />
            <select
              className="text-xs bg-transparent border-none outline-none cursor-pointer text-base-content/70 uppercase font-bold pr-0"
              value={baseUnit}
              onChange={(event) => {
                event.stopPropagation();
                onUpdateUnit?.(item.id, event.target.value as Unit);
              }}
              onClick={(event) => event.stopPropagation()}
              aria-label="Alterar unidade"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
              {baseUnit && !UNITS.includes(baseUnit as Unit) && (
                <option value={baseUnit}>{baseUnit}</option>
              )}
            </select>
          </div>

          {/* Embalagem toggle */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPackFields((prev) => !prev); }}
            title={showPackFields ? "Ocultar rendimento" : "Informar rendimento"}
            className={`px-1.5 border-r border-base-300 h-full text-sm shrink-0 ${showPackFields ? "bg-primary/10 text-primary" : "text-base-content/60"}`}
          >
            📦
          </button>

          {/* Pack size inline (se ativo) */}
          {showPackFields && (
            <div className="flex items-center gap-0.5 px-1.5 border-r border-base-300 shrink-0">
              <span className="text-xs text-base-content/40">×</span>
              <input
                value={packSizeDraft}
                onChange={(e) => setPackSizeDraft(e.target.value)}
                onFocus={(e) => e.target.select()}
                onBlur={handlePackSizeBlur}
                placeholder="0"
                inputMode="decimal"
                className="w-6 text-center text-xs bg-transparent outline-none tabular-nums"
                aria-label="Rendimento por embalagem"
              />
              <select
                className="text-[10px] bg-transparent border-none outline-none cursor-pointer text-base-content/70 uppercase font-bold"
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
                <span className="text-[10px] font-bold text-primary tabular-nums whitespace-nowrap">
                  ={calculatedStockQty}
                </span>
              )}
            </div>
          )}

          {/* Preço — flex-1 para ocupar espaço restante */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-base-300 flex-1 min-w-0">
            <button
              type="button"
              onClick={togglePriceMode}
              title={priceMode === "total" ? `Mudar para R$/${displayUnit}` : "Mudar para total"}
              className="text-[10px] font-bold text-base-content/50 uppercase shrink-0"
            >
              {priceMode === "total" ? "R$" : `/${displayUnit}`}
            </button>
            <input
              value={priceDraft}
              onChange={(e) => setPriceDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={handlePriceBlur}
              placeholder="0,00"
              inputMode="decimal"
              className="flex-1 min-w-0 text-sm bg-transparent text-center outline-none tabular-nums"
              data-testid="shopping-item-price"
            />
            {priceMode === "unit" && calculatedTotal != null && (
              <span className="text-[10px] font-bold text-primary tabular-nums whitespace-nowrap shrink-0">
                ={calculatedTotal.toFixed(0)}
              </span>
            )}
            {item.isPriceStale && (
              <span className="text-[10px] text-warning shrink-0" title="Preço antigo">⚠</span>
            )}
          </div>

          {/* Validade compacta */}
          {item.checked ? (
            <div className="flex items-center gap-1 px-1.5 shrink-0">
              {item.naoAplicaValidade ? (
                <button
                  type="button"
                  onClick={() => onUpdateValidityDate?.(item.id, item.validityDate || null, false)}
                  className="text-sm text-primary"
                  title="Clique para definir validade"
                >
                  ♾️
                </button>
              ) : (
                <>
                  <input
                    type="date"
                    value={item.validityDate || ""}
                    onChange={(e) => onUpdateValidityDate?.(item.id, e.target.value || null, item.naoAplicaValidade)}
                    className="w-[90px] text-[10px] bg-transparent border-none outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => onUpdateValidityDate?.(item.id, null, true)}
                    className="text-[10px] text-base-content/40 hover:text-primary"
                    title="Sem validade"
                  >
                    ♾️
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Placeholder para manter layout consistente quando não checked */
            <div className="w-8 shrink-0" />
          )}
        </div>

        {/* Badges de validade pré-definida (abaixo da barra, só se tiver) */}
        {(item.naoAplicaValidade || (!item.naoAplicaValidade && item.validityDate && !item.checked)) && (
          <div className="flex items-center gap-1.5 mt-1.5 ml-6 sm:ml-7">
            {item.naoAplicaValidade && (
              <Badge variant="info" size="sm" className="text-[10px] h-5">
                ♾️ Sem validade
              </Badge>
            )}
            {!item.naoAplicaValidade && item.validityDate && !item.checked && (
              <Badge variant="info" size="sm" className="text-[10px] h-5">
                📅 {new Date(item.validityDate + "T00:00:00").toLocaleDateString("pt-BR")}
              </Badge>
            )}
          </div>
        )}

        {/* Pack info hint quando há rendimento definido no produto */}
        {hasPack && !showPackFields && (
          <div className="mt-1 ml-6 sm:ml-7">
            <span className="text-[10px] text-base-content/40">
              (rende {product.packSize} {baseUnit})
            </span>
          </div>
        )}
      </CardBody>
    </Card>
  );
});
