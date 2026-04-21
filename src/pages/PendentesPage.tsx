import type { ChangeEvent, Dispatch, ReactElement, SetStateAction } from "react";
import { useState } from "react";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { Checkbox } from "../components/Checkbox/Checkbox";
import { Input } from "../components/Input/Input";
import { Label } from "../components/Label/Label";
import type { PendingItem, PendingStockPayload } from "../types/inventory";
import { CATEGORIES, parseNumericInput, UNITS } from "../utils/inventory";

interface PendingFormProps {
  item: PendingItem;
  onSave: (data: PendingStockPayload) => void;
  onCancel: () => void;
}

interface PendentesPageProps {
  items: PendingItem[];
  onActivate: (pendingId: number, data: PendingStockPayload) => void;
  onDismiss: (pendingId: number) => void;
}

const PendingForm = ({ item, onSave, onCancel }: PendingFormProps): ReactElement => {
  const [canonical, setCanonical] = useState<string>(item.name);
  const [unit, setUnit] = useState<string>("un");
  const [qty, setQty] = useState<string>("1");
  const [minQty, setMinQty] = useState<string>("1");
  const [category, setCategory] = useState<string>("Outros");
  const [autoInclude, setAutoInclude] = useState<boolean>(true);
  const [autoConsume, setAutoConsume] = useState<boolean>(false);
  const [consumePerEvent, setConsumePerEvent] = useState<string>("1");
  const [portion, setPortion] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  const [expiry, setExpiry] = useState<string>("");

  const handleSave = (): void => {
    const parsedQty = parseNumericInput(qty, 1);
    const parsedMin = parseNumericInput(minQty, 1);
    const parsedConsume = parseNumericInput(consumePerEvent, 1, 0.1);

    onSave({
      id: Date.now(),
      name: canonical,
      canonical,
      brand: null,
      category,
      unit,
      qty: parsedQty,
      min: parsedMin,
      autoInclude,
      autoConsume,
      consumePerEvent: autoConsume ? parsedConsume : null,
      portion: autoConsume ? portion : null,
      batches: [
        {
          id: 1,
          qty: parsedQty,
          expiry: expiry || null,
        },
      ],
    });
  };

  const handleNumberInput =
    (setter: Dispatch<SetStateAction<string>>) =>
    (event: ChangeEvent<HTMLInputElement>): void => {
      setter(event.target.value);
    };

  return (
    <div className="bg-base-100 rounded-t-2xl shadow-xl w-full">
      <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
        <h2 className="text-sm font-semibold">Categorizar produto</h2>
        <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Fechar modal">
          x
        </Button>
      </div>

      <div className="px-5 py-4 space-y-4 overflow-y-auto max-h-[70vh]">
        <div>
          <Label htmlFor="canonical-name" size="sm">
            Nome canonico
          </Label>
          <Input
            id="canonical-name"
            value={canonical}
            onChange={(event) => setCanonical(event.target.value)}
            data-testid="pending-canonical"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pending-unit" size="sm">
              Unidade
            </Label>
            <select
              id="pending-unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="select select-bordered w-full"
            >
              {UNITS.map((availableUnit) => (
                <option key={availableUnit} value={availableUnit}>
                  {availableUnit}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="pending-category" size="sm">
              Categoria
            </Label>
            <select
              id="pending-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="select select-bordered w-full"
            >
              {CATEGORIES.map((availableCategory) => (
                <option key={availableCategory} value={availableCategory}>
                  {availableCategory}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pending-qty" size="sm">
              Quantidade
            </Label>
            <Input
              id="pending-qty"
              type="number"
              min="0"
              value={qty}
              onChange={handleNumberInput(setQty)}
            />
          </div>
          <div>
            <Label htmlFor="pending-min" size="sm">
              Qtd. minima
            </Label>
            <Input
              id="pending-min"
              type="number"
              min="0"
              value={minQty}
              onChange={handleNumberInput(setMinQty)}
            />
          </div>
        </div>

        <Card className="border-base-300 shadow-none">
          <CardBody className="space-y-2 p-4">
            <Checkbox
              checked={autoInclude}
              onChange={() => setAutoInclude((previous) => !previous)}
              label="Auto incluir na lista ao acabar"
            />
            <Checkbox
              checked={autoConsume}
              onChange={() => setAutoConsume((previous) => !previous)}
              label="Auto consumo"
            />
          </CardBody>
        </Card>

        {autoConsume && (
          <Card className="bg-primary/5 border-primary/20 shadow-none">
            <CardBody className="space-y-3 p-4">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Configuracao de consumo
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="consume-per-event" size="sm">
                    Consumo por evento ({unit})
                  </Label>
                  <Input
                    id="consume-per-event"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={consumePerEvent}
                    onChange={handleNumberInput(setConsumePerEvent)}
                  />
                </div>
                <div>
                  <Label htmlFor="consume-portion" size="sm">
                    Referencia de porcao
                  </Label>
                  <Input
                    id="consume-portion"
                    value={portion}
                    onChange={(event) => setPortion(event.target.value)}
                    placeholder="Ex: 1 xicara"
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        )}

        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced((previous) => !previous)}
            className="w-full justify-between"
          >
            Lote e validade
            <span>{showAdvanced ? "-" : "+"}</span>
          </Button>

          {showAdvanced && (
            <div className="mt-2">
              <Label htmlFor="expiry-date" size="sm">
                Data de validade
              </Label>
              <Input
                id="expiry-date"
                type="date"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pb-6 pt-3 border-t border-base-300">
        <Button variant="primary" onClick={handleSave} className="w-full">
          Salvar e ativar no estoque
        </Button>
      </div>
    </div>
  );
};

export const PendentesPage = ({
  items,
  onActivate,
  onDismiss,
}: PendentesPageProps): ReactElement => {
  const [selected, setSelected] = useState<PendingItem | null>(null);

  return (
    <div className="flex flex-col h-full">
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSelected(null);
            }
          }}
        >
          <PendingForm
            item={selected}
            onSave={(data) => {
              onActivate(selected.id, data);
              setSelected(null);
            }}
            onCancel={() => setSelected(null)}
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-20">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-base-content/60 text-sm">
            Nenhum item pendente. Finalize uma compra primeiro.
          </div>
        ) : (
          <>
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs text-base-content/60">
                {items.length} {items.length === 1 ? "item aguardando" : "itens aguardando"}{" "}
                categorizacao
              </p>
            </div>
            <ul className="divide-y divide-base-300">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-3 bg-base-100 hover:bg-base-200 transition-colors cursor-pointer"
                  onClick={() => setSelected(item)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.name}</span>
                      <Badge variant="warning" size="sm">
                        Pendente
                      </Badge>
                    </div>
                    <p className="text-xs text-base-content/60 mt-0.5">Toque para categorizar</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      onDismiss(item.id);
                    }}
                    aria-label={`Remover pendencia ${item.name}`}
                  >
                    x
                  </Button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
};
