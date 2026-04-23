import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import {
  getStockConsumptionSummary,
  getStockItemById,
  type StockConsumptionSummary,
  type StockItemRecord,
} from "../lib/webData";

const formatNumber = (value: number): string => {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
};

export const StockItemDetailsPage = () => {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<StockItemRecord | null>(null);
  const [summary, setSummary] = useState<StockConsumptionSummary | null>(null);

  useEffect(() => {
    if (!itemId) return;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const [loadedItem, loadedSummary] = await Promise.all([
          getStockItemById(itemId),
          getStockConsumptionSummary(itemId),
        ]);

        setItem(loadedItem);
        setSummary(loadedSummary);
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Falha ao carregar detalhes do item",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [itemId]);

  if (loading) {
    return (
      <main className="page auth">
        <h1>Carregando consumo</h1>
      </main>
    );
  }

  if (!item || !summary) {
    return (
      <main className="page auth">
        {error ? <Alert type="error">{error}</Alert> : <p>Item nao encontrado.</p>}
        <Button type="button" variant="ghost" onClick={() => navigate("/stock")}>
          Voltar para estoque
        </Button>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Detalhes e consumo</h1>
          <p>{item.nome}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => navigate("/stock")}>
          Voltar
        </Button>
      </header>

      {error && <Alert type="error">{error}</Alert>}

      <div className="grid">
        <Card className="card form">
          <CardBody>
            <h2>Estoque atual</h2>
            <p>
              <strong>{formatNumber(item.quantidade)}</strong> {item.unidade}
            </p>
            <p className="muted">Minimo: {formatNumber(item.quantidade_minima)}</p>
            <p className="muted">
              Consumo configurado: {formatNumber(item.consumo_valor)} / {item.consumo_frequencia}
            </p>
          </CardBody>
        </Card>

        <Card className="card form">
          <CardBody>
            <h2>Consumo medio</h2>
            <p>
              Diario: <strong>{formatNumber(summary.averageDaily)}</strong> {item.unidade}
            </p>
            <p>
              Semanal: <strong>{formatNumber(summary.averageWeekly)}</strong> {item.unidade}
            </p>
            <p>
              Mensal: <strong>{formatNumber(summary.averageMonthly)}</strong> {item.unidade}
            </p>
            <p>
              Ultimos 30 dias: <strong>{formatNumber(summary.consumedLast30Days)}</strong>{" "}
              {item.unidade}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card className="card form">
        <CardBody>
          <h2>Projecao de ruptura</h2>
          {summary.runoutDays === null ? (
            <p className="muted">Sem dados suficientes para calcular dias restantes.</p>
          ) : (
            <p>
              Dias restantes estimados: <strong>{formatNumber(summary.runoutDays)}</strong>
            </p>
          )}
        </CardBody>
      </Card>
    </main>
  );
};
