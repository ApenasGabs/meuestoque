import { useEffect, useState } from "react";
import { getStockMovements, type StockMovementRecord } from "../lib/webData";
import { Alert } from "./Alert/Alert";
import { Badge } from "./Badge/Badge";
import { Button } from "./Button/Button";
import { Card, CardBody } from "./Card/Card";

interface StockHistoryModalProps {
  itemId: string | null;
  itemName: string;
  visible: boolean;
  onClose: () => void;
}

const getTypeMeta = (
  type: StockMovementRecord["tipo"],
): { label: string; variant: "success" | "error" | "info" | "warning" } => {
  if (type === "entrada") return { label: "Entrada", variant: "success" };
  if (type === "saida") return { label: "Saida", variant: "error" };
  if (type === "ajuste") return { label: "Ajuste", variant: "info" };
  return { label: "Consumo auto", variant: "warning" };
};

export const StockHistoryModal = ({
  itemId,
  itemName,
  visible,
  onClose,
}: StockHistoryModalProps) => {
  const [movements, setMovements] = useState<StockMovementRecord[]>([]);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !itemId) return;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const data = await getStockMovements(itemId, limit);
        setMovements(data);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Falha ao carregar historico");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [itemId, limit, visible]);

  if (!visible || !itemId) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card card" role="dialog" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h2>Historico - {itemName}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>

        {error && <Alert type="error">{error}</Alert>}

        {loading ? (
          <p className="muted">Carregando movimentacoes...</p>
        ) : (
          <div className="stack-list mt-4">
            {movements.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="empty-state">Sem movimentacoes para este item.</p>
                </CardBody>
              </Card>
            ) : (
              movements.map((movement) => {
                const meta = getTypeMeta(movement.tipo);
                return (
                  <Card key={movement.id}>
                    <CardBody>
                      <div className="page-header">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        <span className="muted text-sm">
                          {new Date(movement.criado_em).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p>
                        {movement.quantidade.toFixed(2)}{" "}
                        {movement.observacao ? `· ${movement.observacao}` : ""}
                      </p>
                    </CardBody>
                  </Card>
                );
              })
            )}
          </div>
        )}

        <div className="actions-row mt-4">
          <Button type="button" variant="ghost" onClick={() => setLimit((value) => value + 20)}>
            Carregar mais
          </Button>
        </div>
      </div>
    </div>
  );
};
