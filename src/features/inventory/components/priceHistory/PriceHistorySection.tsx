import { useEffect, useState } from "react";
import { getStockLotsByStockItem, type StockLotRecord } from "../../../../lib/webData";
import { Loading } from "../../../../components/Loading/Loading";

interface PriceHistorySectionProps {
  stockItemId: string;
}

export const PriceHistorySection = ({ stockItemId }: PriceHistorySectionProps) => {
  const [history, setHistory] = useState<StockLotRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await getStockLotsByStockItem(stockItemId);
        setHistory(data);
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [stockItemId]);

  if (loading) return <Loading size="sm" />;
  if (history.length === 0) return null;

  return (
    <div className="mt-6 border-t border-base-300 pt-4">
      <h3 className="text-sm font-semibold mb-3">Histórico de Preços</h3>
      <div className="space-y-2">
        {history.slice(0, 5).map((lot) => (
          <div 
            key={lot.id} 
            className="flex items-center justify-between p-2 rounded-lg bg-base-200/50 border border-base-300/30"
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium">
                {new Date(lot.data_compra).toLocaleDateString("pt-BR")}
              </span>
              <span className="text-[10px] text-base-content/50">
                {lot.quantidade_inicial} {lot.unidade}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm font-bold text-primary">
                R$ {lot.custo_unitario?.toFixed(2).replace(".", ",")}
                <span className="text-[10px] font-normal text-base-content/60 ml-1">/{lot.unidade}</span>
              </div>
            </div>
          </div>
        ))}
        {history.length > 5 && (
          <p className="text-[10px] text-center text-base-content/40 mt-2">
            Mostrando os últimos 5 registros de {history.length}
          </p>
        )}
      </div>
    </div>
  );
};
