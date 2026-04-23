import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import {
  deleteShoppingHistory,
  loadShoppingHistory,
  type ShoppingListRecord,
} from "../lib/webData";
import { useGroupStore } from "../stores/groupStore";

export function HistoryPage() {
  const groupId = useGroupStore((state) => state.groupId);
  const groupName = useGroupStore((state) => state.groupName);
  const navigate = useNavigate();
  const [history, setHistory] = useState<ShoppingListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!groupId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await loadShoppingHistory(groupId);
      setHistory(data);
    } catch (historyError) {
      setError(
        historyError instanceof Error ? historyError.message : "Falha ao carregar histórico",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleDeleteHistory = async (listId: string): Promise<void> => {
    if (deletingListId) return;

    const confirmed = window.confirm("Deseja apagar esta lista do histórico?");
    if (!confirmed) return;

    setDeletingListId(listId);
    setError(null);

    try {
      await deleteShoppingHistory(listId);
      await loadHistory();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Falha ao apagar histórico");
    } finally {
      setDeletingListId(null);
    }
  };

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Histórico</h1>
          <p>{groupName ?? "Grupo ativo"}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => navigate("/list")}>
          Voltar para a lista
        </Button>
      </header>

      {error && <Alert type="error">{error}</Alert>}

      <Card className="card">
        <CardBody>
          {loading ? (
            <p className="empty-state">Carregando histórico...</p>
          ) : history.length === 0 ? (
            <p className="empty-state">Nenhuma lista finalizada ainda.</p>
          ) : (
            <div className="stack-list">
              {history.map((list) => (
                <article key={list.id} className="history-item">
                  <div className="history-head">
                    <div>
                      <strong>Lista finalizada</strong>
                      <p>
                        {list.finalizada_em
                          ? new Date(list.finalizada_em).toLocaleString()
                          : "Sem data"}
                      </p>
                    </div>
                    <Badge variant={list.total !== null ? "success" : "warning"}>
                      {list.total !== null ? `R$ ${list.total.toFixed(2)}` : "Sem total"}
                    </Badge>
                  </div>
                  <p>{list.items?.length ?? 0} itens</p>
                  <div className="actions-row mt-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="danger"
                      disabled={deletingListId !== null}
                      onClick={() => void handleDeleteHistory(list.id)}
                    >
                      {deletingListId === list.id ? "Apagando..." : "Apagar histórico"}
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
