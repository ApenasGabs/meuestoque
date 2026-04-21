import type { ReactElement } from "react";
import { useMemo, useState } from "react";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { Input } from "../components/Input/Input";
import type { StockBatch, StockItem } from "../types/inventory";
import { groupByCategory, isExpiringSoon, isLow, parseNumericInput } from "../utils/inventory";

interface ItemDetailModalProps {
  item: StockItem;
  onClose: () => void;
  onUpdateBatches: (id: number, batches: StockBatch[]) => void;
}

interface EstoquePageProps {
  items: StockItem[];
  onConsume: (id: number) => void;
  onUpdateBatches: (id: number, batches: StockBatch[]) => void;
}

const ItemDetailModal = ({
  item,
  onClose,
  onUpdateBatches,
}: ItemDetailModalProps): ReactElement => {
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
      <div className="bg-base-100 rounded-t-2xl w-full shadow-xl">
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

export const EstoquePage = ({
  items,
  onConsume,
  onUpdateBatches,
}: EstoquePageProps): ReactElement => {
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
