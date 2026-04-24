import type { FormEvent, ReactElement } from "react";
import { useState } from "react";
import { Button } from "../../../../components/Button/Button";
import { Checkbox } from "../../../../components/Checkbox/Checkbox";
import { Input } from "../../../../components/Input/Input";
import { Label } from "../../../../components/Label/Label";
import type { InventoryCategory, InventoryProduct } from "../../types";

interface ProductFormModalProps {
  open: boolean;
  product: InventoryProduct | null;
  categories: InventoryCategory[];
  onClose: () => void;
  onSave: (product: Omit<InventoryProduct, "id">, productId?: string) => void;
  onAddCategory: (name: string) => string;
}

export const ProductFormModal = ({
  open,
  product,
  categories,
  onClose,
  onSave,
  onAddCategory,
}: ProductFormModalProps): ReactElement | null => {
  const [name, setName] = useState<string>(product?.name ?? "");
  const [quantity, setQuantity] = useState<string>(String(product?.quantity ?? 0));
  const [minStock, setMinStock] = useState<string>(String(product?.minStock ?? 1));
  const [unit, setUnit] = useState<string>(product?.unit ?? "un");
  const [portionSize, setPortionSize] = useState<string>(String(product?.portionSize ?? 1));
  const [compositeUnit, setCompositeUnit] = useState<boolean>(Boolean(product?.compositeUnit));
  const [categoryId, setCategoryId] = useState<string>(
    product?.categoryId ?? categories[0]?.id ?? "",
  );
  const [validityDate, setValidityDate] = useState<string>(product?.validityDate ?? "");
  const [needsValidity, setNeedsValidity] = useState<boolean>(product?.needsValidity ?? !product);
  const [useNewCategory, setUseNewCategory] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>("");

  if (!open) {
    return null;
  }

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
      unit: unit.trim() || "un",
      portionSize: Math.max(0.0001, Number(portionSize) || 1),
      compositeUnit,
      categoryId: finalCategoryId,
      validityDate: validityDate.trim() || null,
      needsValidity,
    };

    onSave(payload, product?.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/50 flex items-end justify-center p-0 sm:p-4">
      <div className="w-full max-w-lg bg-base-100 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div>
            <h2 className="font-semibold text-sm">{product ? "Editar produto" : "Novo produto"}</h2>
            <p className="text-xs text-base-content/60">
              Use apenas os componentes da raiz e Tailwind.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar formulário">
            x
          </Button>
        </div>

        <form className="p-5 space-y-4" onSubmit={handleSubmit}>
          <div>
            <Label htmlFor="product-name">Nome do produto</Label>
            <Input
              id="product-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex: Arroz"
              required
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
              />
            </div>
            <div>
              <Label htmlFor="product-unit">Unidade</Label>
              <Input
                id="product-unit"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
                placeholder="kg, un, L"
              />
            </div>
          </div>

          <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
            <Checkbox
              checked={compositeUnit}
              onChange={(event) => setCompositeUnit(event.target.checked)}
              label="Unidade composta"
            />
            <div>
              <Label htmlFor="product-portion-size">
                {compositeUnit
                  ? "Fator de consumo (1 unidade consumida equivale a)"
                  : "Porção de consumo"}
              </Label>
              <Input
                id="product-portion-size"
                type="number"
                min="0.0001"
                step="0.0001"
                value={portionSize}
                onChange={(event) => setPortionSize(event.target.value)}
              />
              <p className="text-xs text-base-content/60 mt-1">
                {compositeUnit
                  ? `Exemplo: 0.285 significa que ao consumir 1 un, baixa 0.285 ${unit || "un"} do estoque.`
                  : `Consumo rápido sempre baixa este valor em ${unit || "un"}.`}
              </p>
            </div>
          </div>

          <div className="rounded-box border border-base-300 bg-base-200 p-4 space-y-3">
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
                onChange={(event) => setValidityDate(event.target.value)}
              />
              <p className="text-xs text-base-content/60 mt-1">
                Marque como pendente para pinhar o item no topo até a validade ser informada.
              </p>
            </div>
          </div>

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
              <select
                id="product-category"
                className="select select-bordered w-full"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              {product ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
