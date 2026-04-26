import { useCallback, useEffect, useState, type ReactElement } from "react";
import { Badge } from "../../../../components/Badge/Badge";
import { Drawer } from "../../../../components/Drawer/Drawer";
import { getStockMovements, type StockMovementRecord } from "../../../../lib/webData";

interface ConsumptionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  stockItemId: string;
  productName: string;
}

const TIPO_LABELS: Record<string, { label: string; variant: "success" | "error" | "warning" | "info" }> = {
  entrada: { label: "Entrada", variant: "success" },
  saida: { label: "Saída", variant: "error" },
  ajuste: { label: "Ajuste", variant: "warning" },
  consumo_auto: { label: "Auto-consumo", variant: "info" },
};

const ORIGEM_LABELS: Record<string, string> = {
  list_finalize: "Finalização de lista",
  quick_consume: "Consumo rápido",
  import: "Importação",
  adjustment: "Ajuste manual",
};

/**
 * Drawer showing the consumption/movement history for a specific stock item.
 * Groups movements by day and shows summary statistics.
 */
export const ConsumptionHistoryDrawer = ({
  open,
  onClose,
  stockItemId,
  productName,
}: ConsumptionHistoryDrawerProps): ReactElement | null => {
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMovements = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getStockMovements(stockItemId, 50);
      setMovements(data);
    } catch (error) {
      console.error("Failed to load movements:", error);
    } finally {
      setLoading(false);
    }
  }, [stockItemId]);

  useEffect(() => {
    if (open) {
      loadMovements();
    }
  }, [open, loadMovements]);

  // Summary stats
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const recentMovements = movements.filter(
    (m) => new Date(m.criado_em) >= last30Days,
  );

  const totalConsumed = recentMovements
    .filter((m) => m.tipo === "saida" || m.tipo === "consumo_auto")
    .reduce((sum, m) => sum + m.quantidade, 0);

  const totalAdded = recentMovements
    .filter((m) => m.tipo === "entrada")
    .reduce((sum, m) => sum + m.quantidade, 0);

  const autoConsumedCount = recentMovements.filter(
    (m) => m.tipo === "consumo_auto",
  ).length;

  // Group movements by date
  const groupedByDate = movements.reduce<Record<string, StockMovementRecord[]>>(
    (acc, movement) => {
      const dateKey = new Date(movement.criado_em).toLocaleDateString("pt-BR");
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(movement);
      return acc;
    },
    {},
  );

  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Histórico de Consumo"
      subtitle={productName}
    >
      <div className="space-y-4">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-error/10 border border-error/20 p-2.5 text-center">
            <p className="text-lg font-bold text-error">{totalConsumed}</p>
            <p className="text-[10px] text-base-content/60">Consumido (30d)</p>
          </div>
          <div className="rounded-lg bg-success/10 border border-success/20 p-2.5 text-center">
            <p className="text-lg font-bold text-success">{totalAdded}</p>
            <p className="text-[10px] text-base-content/60">Adicionado (30d)</p>
          </div>
          <div className="rounded-lg bg-info/10 border border-info/20 p-2.5 text-center">
            <p className="text-lg font-bold text-info">{autoConsumedCount}</p>
            <p className="text-[10px] text-base-content/60">Auto-consumos</p>
          </div>
        </div>

        {/* Average consumption */}
        {totalConsumed > 0 && (
          <div className="rounded-lg bg-base-200/50 border border-base-300 p-3">
            <p className="text-xs text-base-content/70">
              📊 Consumo médio:{" "}
              <strong>{(totalConsumed / 30).toFixed(1)}/dia</strong>
              {" · "}
              <strong>{(totalConsumed / 4.3).toFixed(1)}/sem</strong>
              {" · "}
              <strong>{totalConsumed.toFixed(1)}/mês</strong>
            </p>
          </div>
        )}

        {/* Movement list */}
        {loading ? (
          <div className="flex justify-center py-8">
            <span className="loading loading-spinner loading-md" />
          </div>
        ) : movements.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-base-content/50">Nenhum movimento registrado.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(groupedByDate).map(([dateLabel, dayMovements]) => (
              <div key={dateLabel}>
                <p className="text-xs font-semibold text-base-content/60 mb-1.5 sticky top-0 bg-base-100 py-1">
                  📅 {dateLabel}
                </p>
                <div className="space-y-1.5">
                  {dayMovements.map((movement) => {
                    const info = TIPO_LABELS[movement.tipo] ?? {
                      label: movement.tipo,
                      variant: "info" as const,
                    };
                    const time = new Date(movement.criado_em).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    return (
                      <div
                        key={movement.id}
                        className="flex items-center gap-2 p-2 rounded-lg bg-base-200/30 border border-base-300/50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant={info.variant} size="sm">
                              {info.label}
                            </Badge>
                            <span className="text-xs font-medium tabular-nums">
                              {movement.tipo === "entrada" ? "+" : "-"}
                              {movement.quantidade}
                              {movement.unidade ? ` ${movement.unidade}` : ""}
                            </span>
                          </div>
                          {(movement.observacao || movement.origem) && (
                            <p className="text-[10px] text-base-content/50 mt-0.5 truncate">
                              {movement.observacao ??
                                (movement.origem ? ORIGEM_LABELS[movement.origem] ?? movement.origem : "")}
                            </p>
                          )}
                        </div>
                        <span className="text-[10px] text-base-content/40 tabular-nums flex-shrink-0">
                          {time}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Drawer>
  );
};
