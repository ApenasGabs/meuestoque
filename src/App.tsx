import type { ChangeEvent, Dispatch, KeyboardEvent, ReactElement, SetStateAction } from "react";
import { useEffect, useMemo, useState } from "react";
import { Alert } from "./components/Alert/Alert";
import { Badge } from "./components/Badge/Badge";
import { Button } from "./components/Button/Button";
import { Card, CardBody } from "./components/Card/Card";
import { Checkbox } from "./components/Checkbox/Checkbox";
import { Input } from "./components/Input/Input";
import { Label } from "./components/Label/Label";

type TabKey = "lista" | "pendentes" | "estoque";
type SyncStatus = "synced" | "syncing" | "offline" | "error";

interface ShoppingItem {
  id: number;
  name: string;
  checked: boolean;
}

interface PendingItem {
  id: number;
  name: string;
}

interface StockBatch {
  id: number;
  qty: number;
  expiry: string | null;
}

interface StockItem {
  id: number;
  name: string;
  canonical: string;
  brand: string | null;
  category: string;
  unit: string;
  qty: number;
  min: number;
  autoInclude: boolean;
  autoConsume: boolean;
  consumePerEvent: number | null;
  portion?: string | null;
  batches: StockBatch[];
}

interface SyncConfig {
  label: string;
  variant: "success" | "warning" | "error" | "info";
}

interface PendingStockPayload {
  id: number;
  name: string;
  canonical: string;
  brand: string | null;
  category: string;
  unit: string;
  qty: number;
  min: number;
  autoInclude: boolean;
  autoConsume: boolean;
  consumePerEvent: number | null;
  portion: string | null;
  batches: StockBatch[];
}

const INITIAL_STOCK: StockItem[] = [
  {
    id: 1,
    name: "Leite",
    canonical: "Leite",
    brand: "Italac",
    category: "Laticinios",
    unit: "L",
    qty: 2,
    min: 3,
    autoInclude: true,
    autoConsume: false,
    consumePerEvent: null,
    batches: [{ id: 1, qty: 2, expiry: "2026-05-10" }],
  },
  {
    id: 2,
    name: "Ovos",
    canonical: "Ovos",
    brand: null,
    category: "Proteinas",
    unit: "un",
    qty: 6,
    min: 12,
    autoInclude: true,
    autoConsume: false,
    consumePerEvent: null,
    batches: [{ id: 1, qty: 6, expiry: null }],
  },
  {
    id: 3,
    name: "Arroz",
    canonical: "Arroz",
    brand: "Tio Joao",
    category: "Graos",
    unit: "kg",
    qty: 4,
    min: 2,
    autoInclude: false,
    autoConsume: false,
    consumePerEvent: null,
    batches: [{ id: 1, qty: 4, expiry: "2026-12-01" }],
  },
  {
    id: 4,
    name: "Feijao",
    canonical: "Feijao Carioca",
    brand: "Camil",
    category: "Graos",
    unit: "kg",
    qty: 1,
    min: 2,
    autoInclude: true,
    autoConsume: false,
    consumePerEvent: null,
    batches: [{ id: 1, qty: 1, expiry: "2026-09-01" }],
  },
  {
    id: 5,
    name: "Cafe",
    canonical: "Cafe",
    brand: "Pilao",
    category: "Bebidas",
    unit: "g",
    qty: 250,
    min: 200,
    autoInclude: true,
    autoConsume: true,
    consumePerEvent: 10,
    portion: "1 xicara",
    batches: [{ id: 1, qty: 250, expiry: "2026-08-01" }],
  },
  {
    id: 6,
    name: "Azeite",
    canonical: "Azeite",
    brand: "Gallo",
    category: "Condimentos",
    unit: "mL",
    qty: 500,
    min: 100,
    autoInclude: false,
    autoConsume: false,
    consumePerEvent: null,
    batches: [{ id: 1, qty: 500, expiry: "2027-03-01" }],
  },
];

const INITIAL_LIST: ShoppingItem[] = [
  { id: 1, name: "Leite Shefa", checked: false },
  { id: 2, name: "Pao de forma", checked: false },
  { id: 3, name: "Manteiga", checked: false },
  { id: 4, name: "Iogurte natural", checked: false },
  { id: 5, name: "Tomate", checked: false },
];

const INITIAL_PENDING: PendingItem[] = [];

const UNITS = ["un", "kg", "g", "L", "mL", "cx", "pct"] as const;
const CATEGORIES = [
  "Laticinios",
  "Proteinas",
  "Graos",
  "Bebidas",
  "Condimentos",
  "Hortifruti",
  "Higiene",
  "Limpeza",
  "Outros",
] as const;

const isLow = (item: StockItem): boolean => item.qty <= item.min;

const isExpiringSoon = (item: StockItem): boolean => {
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  return item.batches.some((batch) => batch.expiry !== null && new Date(batch.expiry) <= soon);
};

const groupByCategory = (items: StockItem[]): Record<string, StockItem[]> => {
  return items.reduce<Record<string, StockItem[]>>((accumulator, item) => {
    const category = item.category || "Outros";
    if (!accumulator[category]) {
      accumulator[category] = [];
    }
    accumulator[category].push(item);
    return accumulator;
  }, {});
};

const parseNumericInput = (value: string, fallback: number, min = 0): number => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.max(min, parsed);
};

const SyncBadge = ({ status }: { status: SyncStatus }): ReactElement => {
  const configs: Record<SyncStatus, SyncConfig> = {
    synced: { label: "Sincronizado", variant: "success" },
    syncing: { label: "Sincronizando", variant: "warning" },
    offline: { label: "Offline", variant: "info" },
    error: { label: "Erro de sync", variant: "error" },
  };

  const config = configs[status];

  return (
    <Badge variant={config.variant} size="sm" className="font-mono tracking-wide uppercase">
      {config.label}
    </Badge>
  );
};

const Header = ({
  activeTab,
  syncStatus,
}: {
  activeTab: TabKey;
  syncStatus: SyncStatus;
}): ReactElement => {
  const titles: Record<TabKey, string> = {
    lista: "Lista de Compras",
    pendentes: "Pendentes",
    estoque: "Estoque",
  };

  return (
    <header className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
          Meu Estoque
        </p>
        <h1 className="text-base font-semibold tracking-tight">{titles[activeTab]}</h1>
      </div>
      <SyncBadge status={syncStatus} />
    </header>
  );
};

const BottomNav = ({
  activeTab,
  setActiveTab,
  pendingCount,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  pendingCount: number;
}): ReactElement => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex z-30 max-w-md mx-auto">
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "lista" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("lista")}
        data-testid="tab-lista"
      >
        Lista
      </Button>
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "pendentes" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("pendentes")}
        data-testid="tab-pendentes"
      >
        Pendentes
        {pendingCount > 0 && (
          <Badge variant="warning" size="sm" className="ml-2">
            {pendingCount}
          </Badge>
        )}
      </Button>
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "estoque" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("estoque")}
        data-testid="tab-estoque"
      >
        Estoque
      </Button>
    </nav>
  );
};

const ListaScreen = ({
  items,
  setItems,
  onFinalize,
}: {
  items: ShoppingItem[];
  setItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  onFinalize: (checkedItems: ShoppingItem[]) => void;
}): ReactElement => {
  const [input, setInput] = useState<string>("");
  const checkedCount = items.filter((item) => item.checked).length;

  const addItem = (): void => {
    const value = input.trim();
    if (!value) {
      return;
    }

    setItems((previous) => [...previous, { id: Date.now(), name: value, checked: false }]);
    setInput("");
  };

  const toggleItem = (id: number): void => {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const removeItem = (id: number): void => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      addItem();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 bg-base-100 border-b border-base-300 sticky top-14 z-20">
        <div className="flex gap-2 items-end">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Adicionar item a lista"
            className="w-full"
            data-testid="shopping-input"
          />
          <Button
            variant="primary"
            onClick={addItem}
            aria-label="Adicionar item"
            className="min-w-12"
            data-testid="add-item-btn"
          >
            +
          </Button>
        </div>

        {checkedCount > 0 && (
          <p className="text-xs text-base-content/60 mt-2 font-mono">
            {checkedCount} de {items.length} marcados
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-base-content/60 text-sm">
            Lista vazia. Adicione um item acima.
          </div>
        ) : (
          <ul className="divide-y divide-base-300">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 bg-base-100 transition-opacity ${item.checked ? "opacity-50" : ""}`}
              >
                <Checkbox
                  checked={item.checked}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Marcar item ${item.name}`}
                />

                <span
                  className={`flex-1 text-sm ${item.checked ? "line-through text-base-content/50" : "text-base-content"}`}
                >
                  {item.name}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover item ${item.name}`}
                  data-testid={`remove-${item.id}`}
                >
                  x
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {checkedCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 max-w-md mx-auto px-4 pb-3">
          <Button
            variant="primary"
            onClick={() => onFinalize(items.filter((item) => item.checked))}
            className="w-full"
            data-testid="finalize-btn"
          >
            Finalizar Compra ({checkedCount} {checkedCount === 1 ? "item" : "itens"})
          </Button>
        </div>
      )}
    </div>
  );
};

const PendingForm = ({
  item,
  onSave,
  onCancel,
}: {
  item: PendingItem;
  onSave: (data: PendingStockPayload) => void;
  onCancel: () => void;
}): ReactElement => {
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
    <div className="bg-base-100 rounded-t-2xl shadow-xl w-full max-w-md mx-auto">
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

const PendentesScreen = ({
  items,
  onActivate,
  onDismiss,
}: {
  items: PendingItem[];
  onActivate: (pendingId: number, data: PendingStockPayload) => void;
  onDismiss: (pendingId: number) => void;
}): ReactElement => {
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

const ItemDetailModal = ({
  item,
  onClose,
  onUpdateBatches,
}: {
  item: StockItem;
  onClose: () => void;
  onUpdateBatches: (id: number, batches: StockBatch[]) => void;
}): ReactElement => {
  const [batches, setBatches] = useState<StockBatch[]>(item.batches);
  const [newQty, setNewQty] = useState<string>("");
  const [newExpiry, setNewExpiry] = useState<string>("");

  const addBatch = (): void => {
    if (!newQty.trim()) {
      return;
    }

    const parsedQty = parseNumericInput(newQty, 0);
    if (parsedQty <= 0) {
      return;
    }

    setBatches((previous) => [
      ...previous,
      { id: Date.now(), qty: parsedQty, expiry: newExpiry || null },
    ]);
    setNewQty("");
    setNewExpiry("");
  };

  const removeBatch = (id: number): void => {
    setBatches((previous) => previous.filter((batch) => batch.id !== id));
  };

  const save = (): void => {
    onUpdateBatches(item.id, batches);
    onClose();
  };

  const formatExpiry = (value: string | null): string => {
    if (!value) {
      return "Sem validade";
    }
    return new Date(value).toLocaleDateString("pt-BR");
  };

  const isExpired = (value: string | null): boolean => {
    if (!value) {
      return false;
    }
    return new Date(value) < new Date();
  };

  const isSoon = (value: string | null): boolean => {
    if (!value) {
      return false;
    }
    const soon = new Date();
    soon.setDate(soon.getDate() + 7);
    const target = new Date(value);
    return target <= soon && target >= new Date();
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex items-end justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-base-100 rounded-t-2xl w-full max-w-md mx-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
          <div>
            <h2 className="text-sm font-semibold">{item.name}</h2>
            <p className="text-xs text-base-content/60">
              {item.category} | {item.unit}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fechar detalhes">
            x
          </Button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto space-y-4">
          <p className="text-xs font-semibold uppercase text-base-content/60">Lotes</p>

          {batches.length === 0 && (
            <p className="text-sm text-base-content/60">Nenhum lote cadastrado.</p>
          )}

          <ul className="space-y-2">
            {batches.map((batch) => (
              <li
                key={batch.id}
                className="flex items-center justify-between bg-base-200 rounded-lg px-3 py-2"
              >
                <div>
                  <span className="text-sm font-medium">
                    {batch.qty} {item.unit}
                  </span>
                  <div className="mt-1 flex items-center gap-2">
                    {isExpired(batch.expiry) && <Badge variant="error">Vencido</Badge>}
                    {!isExpired(batch.expiry) && isSoon(batch.expiry) && (
                      <Badge variant="warning">Vence em breve</Badge>
                    )}
                    <span className="text-xs text-base-content/60">
                      {formatExpiry(batch.expiry)}
                    </span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeBatch(batch.id)}
                  aria-label={`Remover lote ${batch.id}`}
                >
                  x
                </Button>
              </li>
            ))}
          </ul>

          <Card className="shadow-none border-base-300">
            <CardBody className="space-y-2 p-4">
              <p className="text-xs font-semibold uppercase text-base-content/60">Adicionar lote</p>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder={`Qtd (${item.unit})`}
                  value={newQty}
                  onChange={(event) => setNewQty(event.target.value)}
                />
                <Input
                  type="date"
                  value={newExpiry}
                  onChange={(event) => setNewExpiry(event.target.value)}
                />
              </div>
              <Button variant="secondary" onClick={addBatch} className="w-full">
                Adicionar lote
              </Button>
            </CardBody>
          </Card>
        </div>

        <div className="px-5 pb-6 pt-2 border-t border-base-300">
          <Button variant="primary" onClick={save} className="w-full">
            Salvar alteracoes
          </Button>
        </div>
      </div>
    </div>
  );
};

const EstoqueScreen = ({
  items,
  onConsume,
  onUpdateBatches,
}: {
  items: StockItem[];
  onConsume: (id: number) => void;
  onUpdateBatches: (id: number, batches: StockBatch[]) => void;
}): ReactElement => {
  const [detailItem, setDetailItem] = useState<StockItem | null>(null);
  const [flashId, setFlashId] = useState<number | null>(null);

  const grouped = useMemo(() => groupByCategory(items), [items]);

  const handleConsume = (id: number): void => {
    setFlashId(id);
    window.setTimeout(() => setFlashId(null), 400);
    onConsume(id);
  };

  const hasAlerts = items.some((item) => isLow(item) || isExpiringSoon(item));

  return (
    <div className="flex flex-col h-full">
      {detailItem && (
        <ItemDetailModal
          item={detailItem}
          onClose={() => setDetailItem(null)}
          onUpdateBatches={(id, batches) => {
            onUpdateBatches(id, batches);
            setDetailItem(null);
          }}
        />
      )}

      {hasAlerts && (
        <div className="mx-4 mt-4">
          <Alert type="warning" testId="stock-alert">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase">Atencao necessaria</p>
              <div className="flex flex-wrap gap-1.5">
                {items
                  .filter((item) => isLow(item))
                  .map((item) => (
                    <Badge key={`low-${item.id}`} variant="error" size="sm">
                      {item.name} acabando
                    </Badge>
                  ))}
                {items
                  .filter((item) => isExpiringSoon(item) && !isLow(item))
                  .map((item) => (
                    <Badge key={`exp-${item.id}`} variant="warning" size="sm">
                      {item.name} vence em breve
                    </Badge>
                  ))}
              </div>
            </div>
          </Alert>
        </div>
      )}

      <div className="flex-1 overflow-y-auto pb-24 pt-2">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category} className="mb-2">
            <div className="px-4 pt-4 pb-2">
              <span className="text-xs font-semibold uppercase text-base-content/60 tracking-wide">
                {category}
              </span>
            </div>

            <ul className="divide-y divide-base-300">
              {categoryItems.map((item) => (
                <li
                  key={item.id}
                  className={`flex items-center gap-3 px-4 py-3 bg-base-100 transition-colors ${flashId === item.id ? "bg-error/10" : ""}`}
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => setDetailItem(item)}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.brand && (
                        <span className="text-xs text-base-content/60">{item.brand}</span>
                      )}
                      {isLow(item) && (
                        <Badge variant="error" size="sm">
                          Acabando
                        </Badge>
                      )}
                      {isExpiringSoon(item) && !isLow(item) && (
                        <Badge variant="warning" size="sm">
                          Vence
                        </Badge>
                      )}
                    </div>

                    <p className="text-xs text-base-content/60 mt-1 font-mono">
                      {item.qty} {item.unit} <span className="mx-1">|</span> min {item.min}{" "}
                      {item.unit}
                    </p>
                  </button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleConsume(item.id)}
                    disabled={item.qty <= 0}
                  >
                    -1 {item.unit}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};

const App = (): ReactElement => {
  const [activeTab, setActiveTab] = useState<TabKey>("lista");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("synced");
  const [listItems, setListItems] = useState<ShoppingItem[]>(INITIAL_LIST);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>(INITIAL_PENDING);
  const [stockItems, setStockItems] = useState<StockItem[]>(INITIAL_STOCK);

  useEffect(() => {
    document.title = "Meu Estoque";
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSyncStatus("syncing");
      window.setTimeout(() => setSyncStatus("synced"), 1200);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, []);

  const handleFinalize = (checkedItems: ShoppingItem[]): void => {
    const now = Date.now();
    const newPending = checkedItems.map((item, index) => ({
      id: now + index,
      name: item.name,
    }));

    setPendingItems((previous) => [...previous, ...newPending]);
    setListItems((previous) => previous.filter((item) => !item.checked));
    setSyncStatus("syncing");
    window.setTimeout(() => setSyncStatus("synced"), 1000);
    setActiveTab("pendentes");
  };

  const handleActivate = (pendingId: number, data: PendingStockPayload): void => {
    setPendingItems((previous) => previous.filter((item) => item.id !== pendingId));
    setStockItems((previous) => {
      const existing = previous.find(
        (item) => item.canonical.toLowerCase() === data.canonical.toLowerCase(),
      );

      if (!existing) {
        return [...previous, data];
      }

      return previous.map((item) => {
        if (item.id !== existing.id) {
          return item;
        }

        return {
          ...item,
          qty: item.qty + data.qty,
          batches: [...item.batches, ...data.batches],
        };
      });
    });

    setSyncStatus("syncing");
    window.setTimeout(() => setSyncStatus("synced"), 1000);
  };

  const handleDismiss = (id: number): void => {
    setPendingItems((previous) => previous.filter((item) => item.id !== id));
  };

  const handleConsume = (id: number): void => {
    setStockItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) {
          return item;
        }

        const decrease = item.autoConsume && item.consumePerEvent ? item.consumePerEvent : 1;
        const sortedBatches = [...item.batches].sort((first, second) => {
          if (!first.expiry) {
            return 1;
          }
          if (!second.expiry) {
            return -1;
          }
          return new Date(first.expiry).getTime() - new Date(second.expiry).getTime();
        });

        let remaining = decrease;

        const updatedBatches = sortedBatches
          .map((batch) => {
            if (remaining <= 0) {
              return batch;
            }

            const consumeFromBatch = Math.min(batch.qty, remaining);
            remaining -= consumeFromBatch;
            return {
              ...batch,
              qty: batch.qty - consumeFromBatch,
            };
          })
          .filter((batch) => batch.qty > 0);

        return {
          ...item,
          qty: Math.max(0, item.qty - decrease),
          batches: updatedBatches,
        };
      }),
    );

    setSyncStatus("syncing");
    window.setTimeout(() => setSyncStatus("synced"), 800);
  };

  const handleUpdateBatches = (id: number, batches: StockBatch[]): void => {
    setStockItems((previous) =>
      previous.map((item) => {
        if (item.id !== id) {
          return item;
        }

        return {
          ...item,
          batches,
          qty: batches.reduce((sum, batch) => sum + batch.qty, 0),
        };
      }),
    );
  };

  const screens: Record<TabKey, ReactElement> = {
    lista: <ListaScreen items={listItems} setItems={setListItems} onFinalize={handleFinalize} />,
    pendentes: (
      <PendentesScreen items={pendingItems} onActivate={handleActivate} onDismiss={handleDismiss} />
    ),
    estoque: (
      <EstoqueScreen
        items={stockItems}
        onConsume={handleConsume}
        onUpdateBatches={handleUpdateBatches}
      />
    ),
  };

  return (
    <div className="flex justify-center bg-base-200 min-h-screen">
      <div className="w-full max-w-md bg-base-100 min-h-screen flex flex-col relative border-x border-base-300">
        <Header activeTab={activeTab} syncStatus={syncStatus} />
        <main className="flex-1 overflow-hidden flex flex-col">{screens[activeTab]}</main>
        <BottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingItems.length}
        />
      </div>
    </div>
  );
};

export default App;
