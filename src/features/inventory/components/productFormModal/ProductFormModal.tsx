import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Button } from "../../../../components/Button/Button";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";
import { Drawer } from "../../../../components/Drawer/Drawer";
import { Fieldset } from "../../../../components/Fieldset/Fieldset";
import { Input } from "../../../../components/Input/Input";
import { Label } from "../../../../components/Label/Label";
import { Select } from "../../../../components/Select/Select";
import type { InventoryCategory, InventoryProduct } from "../../types";
import { PriceHistorySection } from "../priceHistory/PriceHistorySection";
import type { Unit } from "../../../../types/inventory.types";
import { toUnit, UNITS } from "../../../../types/inventory.types";

interface ProductFormModalProps {
  open: boolean;
  product: InventoryProduct | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onSave: (product: Omit<InventoryProduct, "id">, productId?: string) => void;
  onAddCategory: (name: string) => string;
  /**
   * Optional callback invoked when the user explicitly re-enables expiration tracking
   * for a stock item that was previously flagged as "Não se aplica" (Spec Gap 7 — Undo).
   */
  onMarkPerishable?: (productId: string) => Promise<void> | void;
}

/**
 * Calculates estimated days until stock runs out based on consumption config.
 */
const calculateRunoutDays = (
  quantity: number,
  consumeValue: number,
  consumeFrequency: "daily" | "weekly" | "monthly",
  portionSize: number,
): number | null => {
  if (consumeValue <= 0 || quantity <= 0) return null;
  const dailyConsumption =
    consumeFrequency === "daily"
      ? consumeValue * portionSize
      : consumeFrequency === "weekly"
        ? (consumeValue * portionSize) / 7
        : (consumeValue * portionSize) / 30;
  if (dailyConsumption <= 0) return null;
  return Math.floor(quantity / dailyConsumption);
};

const FREQUENCY_LABELS: Record<string, string> = {
  daily: "por dia",
  weekly: "por semana",
  monthly: "por mês",
};

/**
 * Modal/Drawer component for creating or editing inventory products.
 * 
 * Features:
 * - Basic product info (name, quantity, min stock, unit)
 * - Composite unit support (packs, boxes) with conversion factors
 * - Auto-consumption configuration with runout prediction
 * - Validity date management with "pending" state tracking
 * - Category selection and creation
 * - Price history integration for existing products
 * 
 * @param props.open - Whether the modal is visible
 * @param props.product - Product data to edit, or null for new product
 * @param props.categories - List of available categories
 * @param props.onClose - Callback when modal is dismissed
 * @param props.onSave - Callback when product is saved
 * @param props.onAddCategory - Callback to create a new category
 */
export const ProductFormModal = ({
  open,
  product,
  categories,
  onClose,
  onSave,
  onAddCategory,
  onMarkPerishable,
}: ProductFormModalProps): ReactElement => {
  const [name, setName] = useState<string>(product?.name ?? "");
  const [quantity, setQuantity] = useState<string>(String(product?.quantity ?? 0));
  const [minStock, setMinStock] = useState<string>(String(product?.minStock ?? 1));
  const [unit, setUnit] = useState<Unit | "outro">(product?.unit ?? "Un");
  const [portionSize, setPortionSize] = useState<string>(String(product?.portionSize ?? 1));
  const [compositeUnit, setCompositeUnit] = useState<boolean>(Boolean(product?.compositeUnit));
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId ?? categories[0]?.id ?? "",
  );
  const [validityDate, setValidityDate] = useState<string>(product?.validityDate ?? "");
  const [needsValidity, setNeedsValidity] = useState<boolean>(product?.needsValidity ?? !product);
  const [packLabel, setPackLabel] = useState<string>(product?.packLabel ?? "");
  const [packSize, setPackSize] = useState<string>(String(product?.packSize ?? 1));
  const [useNewCategory, setUseNewCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");
  const [customUnit, setCustomUnit] = useState<string>("");

  // Auto-consumption state
  const [autoConsumeEnabled, setAutoConsumeEnabled] = useState<boolean>(
    (product?.consumeValue ?? 0) > 0,
  );
  const [consumeFrequency, setConsumeFrequency] = useState<"daily" | "weekly" | "monthly">(
    product?.consumeFrequency ?? "daily",
  );
  const [consumeValue, setConsumeValue] = useState<string>(String(product?.consumeValue ?? 1));
  const [autoAddToList, setAutoAddToList] = useState<boolean>(product?.autoAddToList ?? true);

  // Runout prediction
  const runoutDays = autoConsumeEnabled
    ? calculateRunoutDays(
        Number(quantity),
        Number(consumeValue),
        consumeFrequency,
        Math.max(0.0001, Number(portionSize) || 1),
      )
    : null;

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    let finalCategoryId = categoryId;

    if (useNewCategory && newCategoryName.trim()) {
      finalCategoryId = onAddCategory(newCategoryName.trim());
    }

    const payload: Omit<InventoryProduct, "id"> = {
      name: trimmedName,
      quantity: Number(quantity),
      minStock: Number(minStock),
      unit: unit === "outro" ? toUnit(customUnit) : toUnit(unit),
      portionSize: Math.max(0.0001, Number(portionSize) || 1),
      compositeUnit,
      categoryId: finalCategoryId,
      validityDate: validityDate.trim() || null,
      needsValidity,
      packLabel: packLabel.trim() || undefined,
      packSize: compositeUnit ? Math.max(0.0001, Number(packSize) || 1) : undefined,
      autoAddToList: autoConsumeEnabled ? autoAddToList : false,
      consumeFrequency,
      consumeValue: autoConsumeEnabled ? Math.max(0, Number(consumeValue) || 0) : 0,
    };

    onSave(payload, product?.id);
    onClose();
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={product ? "Editar produto" : "Novo produto"}
      subtitle="Preencha os dados do produto para o estoque."
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <Label htmlFor="product-name">Nome do produto</Label>
          <Input
            id="product-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex: Arroz"
            required
            data-testid="product-name"
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label htmlFor="product-quantity">Qtd atual</Label>
            <Input
              id="product-quantity"
              type="number"
              min="0"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              data-testid="product-quantity"
            />
          </div>
          <div>
            <Label htmlFor="product-min">Mínimo</Label>
            <Input
              id="product-min"
              type="number"
              min="0"
              value={minStock}
              onChange={(event) => setMinStock(event.target.value)}
              data-testid="product-min"
            />
          </div>
          <div>
            <Label htmlFor="product-unit">Unidade</Label>
            <Select
              id="product-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value as Unit | "outro")}
              data-testid="product-unit"
            >
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value="outro">Outro</option>
            </Select>
            {unit === "outro" && (
              <Input
                className="mt-1"
                value={customUnit}
                placeholder="Digite a unidade"
                onChange={(event) => setCustomUnit(event.target.value)}
              />
            )}
          </div>
        </div>

        <Fieldset legend="Unidade composta (Conversão de Embalagem)">
          <Checkbox
            checked={compositeUnit}
            onChange={(event) => setCompositeUnit(event.target.checked)}
            label="Item usa unidade composta (ex: fardo, caixa)"
          />
          {compositeUnit && (
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <Label htmlFor="product-pack-label">Embalagem</Label>
                <Input
                  id="product-pack-label"
                  value={packLabel}
                  onChange={(event) => setPackLabel(event.target.value)}
                  placeholder="Ex: Fardo, Caixa"
                />
              </div>
              <div>
                <Label htmlFor="product-pack-size">
                  Rendimento ({unit || "un"})
                </Label>
                <Input
                  id="product-pack-size"
                  type="number"
                  min="0.0001"
                  step="0.0001"
                  value={packSize}
                  onChange={(event) => setPackSize(event.target.value)}
                />
              </div>
            </div>
          )}
          <div className="mt-3">
            <Label htmlFor="product-portion-size">
              {compositeUnit
                ? "Fator de consumo (1 embalagem equivale a)"
                : "Porção de consumo padrão"}
            </Label>
            <Input
              id="product-portion-size"
              type="number"
              min="0.0001"
              step="0.0001"
              value={portionSize}
              onChange={(event) => setPortionSize(event.target.value)}
              data-testid="product-portion-size"
            />
            <p className="text-xs text-base-content/60 mt-1">
              {compositeUnit
                ? `Exemplo: Se a embalagem rende 12 ${unit || "un"}, consumir 1 baixa 1/12 da embalagem (aprox 0.083).`
                : `Consumo rápido sempre baixa este valor em ${unit || "un"}.`}
            </p>
          </div>
        </Fieldset>

        {/* === Auto-Consumption Section (Feature #11) === */}
        <Fieldset legend="🤖 Consumo Automático">
          <Checkbox
            checked={autoConsumeEnabled}
            onChange={(event) => setAutoConsumeEnabled(event.target.checked)}
            label="Ativar consumo automático"
          />
          {autoConsumeEnabled && (
            <div className="mt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="product-consume-value">Porções por ciclo</Label>
                  <Input
                    id="product-consume-value"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={consumeValue}
                    onChange={(event) => setConsumeValue(event.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="product-consume-frequency">Frequência</Label>
                  <Select
                    id="product-consume-frequency"
                    value={consumeFrequency}
                    onChange={(event) =>
                      setConsumeFrequency(
                        event.target.value as "daily" | "weekly" | "monthly",
                      )
                    }
                    options={[
                      { value: "daily", label: "Diário" },
                      { value: "weekly", label: "Semanal" },
                      { value: "monthly", label: "Mensal" },
                    ]}
                  />
                </div>
              </div>

              <Checkbox
                checked={autoAddToList}
                onChange={(event) => setAutoAddToList(event.target.checked)}
                label="Adicionar à lista automaticamente quando estoque baixo"
              />

              {/* Smart prediction panel (Feature #13) */}
              <div className="rounded-lg bg-base-200/50 border border-base-300 p-3 space-y-1">
                <p className="text-xs text-base-content/70">
                  📊 Este item consumirá{" "}
                  <strong>
                    {consumeValue} {compositeUnit ? "emb." : (unit === "outro" ? customUnit : unit) || "un"}.
                  </strong>{" "}
                  {FREQUENCY_LABELS[consumeFrequency]}.
                </p>
                {runoutDays !== null && (
                  <p
                    className={`text-xs font-medium ${
                      runoutDays <= 3
                        ? "text-error"
                        : runoutDays <= 7
                          ? "text-warning"
                          : "text-success"
                    }`}
                  >
                    {runoutDays <= 0
                      ? "⚠️ Estoque insuficiente! Reponha agora."
                      : runoutDays <= 3
                        ? `⚡ Com ${quantity} em estoque, durará apenas ~${runoutDays} dia${runoutDays !== 1 ? "s" : ""}. Reponha logo!`
                        : runoutDays <= 7
                          ? `⏰ Com ${quantity} em estoque, durará ~${runoutDays} dias.`
                          : `✅ Com ${quantity} em estoque, durará ~${runoutDays} dias.`}
                  </p>
                )}
              </div>
            </div>
          )}
        </Fieldset>

        <Fieldset legend="Validade">
          {/* Undo flow: if the item was marked "Não se aplica" via bulk action, allow
              the user to revert and start tracking validity again. */}
          {product?.naoAplicaValidade && onMarkPerishable && (
            <div className="mb-3 p-3 rounded-lg border border-info/40 bg-info/5 space-y-2">
              <p className="text-xs text-base-content/80">
                Este item está marcado como <strong>não perecível</strong>. Voltar a controlar
                validade reativa os alertas para este produto.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (product?.id) {
                    void onMarkPerishable(product.id);
                  }
                }}
              >
                Tratar como perecível novamente
              </Button>
            </div>
          )}
          <Checkbox
            checked={needsValidity}
            onChange={(event) => setNeedsValidity(event.target.checked)}
            label="Pendente de validade"
            color="error"
          />
          <div>
            <Label htmlFor="product-validity-date">Data de validade</Label>
            <Input
              id="product-validity-date"
              type="date"
              value={validityDate}
              onChange={(event) => {
                setValidityDate(event.target.value);
                if (event.target.value) {
                  setNeedsValidity(false);
                }
              }}
            />
            <p className="text-xs text-base-content/60 mt-1">
              Marque como pendente para pinhar o item no topo até a validade ser informada.
            </p>
          </div>
        </Fieldset>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="product-category">Categoria</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUseNewCategory((previous) => !previous)}
            >
              {useNewCategory ? "Usar existente" : "Nova categoria"}
            </Button>
          </div>

          {useNewCategory ? (
            <Input
              value={newCategoryName}
              onChange={(event) => setNewCategoryName(event.target.value)}
              placeholder="Nome da nova categoria"
            />
          ) : (
            <Select
              id="product-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              options={categories.map((category) => ({
                value: category.id,
                label: category.name,
              }))}
            />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="flex-1"
            data-testid="product-save-button"
          >
            {product ? "Salvar" : "Adicionar"}
          </Button>
        </div>

        {product?.id && <PriceHistorySection stockItemId={product.id} />}
      </form>
    </Drawer>
  );
};
