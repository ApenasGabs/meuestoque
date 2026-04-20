import type { ReactElement } from "react";
import { useEffect, useMemo, useState } from "react";
import { AppBottomNav } from "./components/AppBottomNav/AppBottomNav";
import { AppHeader } from "./components/AppHeader/AppHeader";
import { INITIAL_LIST, INITIAL_PENDING, INITIAL_STOCK } from "./data/initialInventoryData";
import { EstoquePage } from "./pages/EstoquePage";
import { ListaPage } from "./pages/ListaPage";
import { PendentesPage } from "./pages/PendentesPage";
import type {
  PendingItem,
  PendingStockPayload,
  ShoppingItem,
  StockBatch,
  StockItem,
  SyncStatus,
  TabKey,
} from "./types/inventory";

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

  const activePage = useMemo<Record<TabKey, ReactElement>>(
    () => ({
      lista: <ListaPage items={listItems} setItems={setListItems} onFinalize={handleFinalize} />,
      pendentes: (
        <PendentesPage items={pendingItems} onActivate={handleActivate} onDismiss={handleDismiss} />
      ),
      estoque: (
        <EstoquePage
          items={stockItems}
          onConsume={handleConsume}
          onUpdateBatches={handleUpdateBatches}
        />
      ),
    }),
    [listItems, pendingItems, stockItems],
  );

  return (
    <div className="bg-base-200 min-h-screen">
      <div className="w-full bg-base-100 min-h-screen flex flex-col relative">
        <AppHeader activeTab={activeTab} syncStatus={syncStatus} />
        <main className="flex-1 overflow-hidden flex flex-col">{activePage[activeTab]}</main>
        <AppBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingItems.length}
        />
      </div>
    </div>
  );
};

export default App;
