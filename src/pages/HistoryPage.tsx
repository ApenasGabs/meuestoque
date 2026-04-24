import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import {
  addListItem,
  deleteShoppingHistory,
  duplicateShoppingListToActive,
  ensureActiveListForGroup,
  loadShoppingHistory,
  updateShoppingHistoryPurchaseDate,
  type ItemRecord,
  type ShoppingListRecord,
} from "../lib/webData";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";

export function HistoryPage() {
  const groupId = useGroupStore((state) => state.groupId);
  const groupName = useGroupStore((state) => state.groupName);
  const setListId = useGroupStore((state) => state.setListId);
  const userId = useAuthStore((state) => state.userId);
  const navigate = useNavigate();
  const [history, setHistory] = useState<ShoppingListRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deletingListId, setDeletingListId] = useState<string | null>(null);
  const [duplicatingListId, setDuplicatingListId] = useState<string | null>(null);
  const [editingDateListId, setEditingDateListId] = useState<string | null>(null);
  const [addingItemId, setAddingItemId] = useState<string | null>(null);
  const [dateDrafts, setDateDrafts] = useState<Record<string, string>>({});

  const loadHistory = useCallback(async (): Promise<void> => {
    if (!groupId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await loadShoppingHistory(groupId);
      setHistory(data);
      setDateDrafts(
        Object.fromEntries(
          data.map((list) => [
            list.id,
            list.closed_purchase_date ??
              (list.finalizada_em ? new Date(list.finalizada_em).toISOString().slice(0, 10) : ""),
          ]),
        ),
      );
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

  useEffect(() => {
    if (!notice) return;

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [notice]);

  const handleDuplicateList = async (sourceListId: string): Promise<void> => {
    if (!groupId || duplicatingListId) return;

    setDuplicatingListId(sourceListId);
    setError(null);

    try {
      const result = await duplicateShoppingListToActive(groupId, sourceListId, userId);
      setListId(result.targetListId);

      if (result.duplicatedCount === 0) {
        setNotice("Nenhum item novo para duplicar na lista ativa.");
      } else {
        setNotice(`${result.duplicatedCount} item(ns) duplicado(s) na lista ativa.`);
      }
    } catch (duplicateError) {
      setError(
        duplicateError instanceof Error ? duplicateError.message : "Falha ao duplicar lista",
      );
    } finally {
      setDuplicatingListId(null);
    }
  };

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

  const handleSavePurchaseDate = async (listId: string): Promise<void> => {
    const draftDate = dateDrafts[listId]?.trim() ?? "";
    if (!draftDate) {
      setError("Informe uma data válida");
      return;
    }

    setEditingDateListId(listId);
    setError(null);

    try {
      await updateShoppingHistoryPurchaseDate(listId, draftDate);
      await loadHistory();
      setNotice("Data da compra atualizada.");
    } catch (dateError) {
      setError(
        dateError instanceof Error ? dateError.message : "Falha ao atualizar data da compra",
      );
    } finally {
      setEditingDateListId(null);
    }
  };

  const handleAddSingleItem = async (item: ItemRecord): Promise<void> => {
    if (!groupId || addingItemId) return;

    setAddingItemId(item.id);
    setError(null);

    try {
      const activeList = await ensureActiveListForGroup(groupId);
      setListId(activeList.id);
      
      await addListItem({
        listId: activeList.id,
        nome: item.nome,
        quantidade: item.quantidade,
        categoria: item.categoria,
        price: item.preco,
        createdBy: userId,
      });
      
      setNotice(`${item.nome} adicionado à lista atual.`);
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Falha ao adicionar item",
      );
    } finally {
      setAddingItemId(null);
    }
  };

  return (
    <main className="page">
      {notice && (
        <div className="toast toast-top toast-end z-50">
          <div className="alert alert-success">
            <span>{notice}</span>
          </div>
        </div>
      )}

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
                      <p className="text-xs text-base-content/70 mt-1">
                        Data da compra: {list.closed_purchase_date ?? "não informada"}
                      </p>
                    </div>
                    <Badge variant={list.total !== null ? "success" : "warning"}>
                      {list.total !== null ? `R$ ${list.total.toFixed(2)}` : "Sem total"}
                    </Badge>
                  </div>
                  
                  <div className="mt-4 border-t border-base-300 pt-3">
                    <p className="font-semibold text-sm text-base-content/80 mb-2">
                      {list.items?.length ?? 0} itens comprados
                    </p>
                    
                    {list.items && list.items.length > 0 && (
                      <div className="space-y-2 mb-4">
                        {list.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between bg-base-200/50 border border-base-300/50 p-2 rounded-lg text-sm gap-2">
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="font-medium truncate">{item.nome}</span>
                              <span className="text-xs text-base-content/50">
                                {item.quantidade} • {item.categoria}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {item.preco !== null && (
                                <span className="font-bold text-xs text-primary">
                                  R$ {item.preco.toFixed(2)}
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="px-2"
                                disabled={addingItemId === item.id}
                                onClick={() => void handleAddSingleItem(item)}
                                aria-label={`Adicionar ${item.nome} na lista`}
                              >
                                {addingItemId === item.id ? "..." : <ShoppingCartOutlined />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 border-t border-base-300 pt-3">
                    <label className="form-control">
                      <span className="label-text text-xs">Editar data da compra</span>
                      <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={dateDrafts[list.id] ?? ""}
                        onChange={(event) =>
                          setDateDrafts((current) => ({
                            ...current,
                            [list.id]: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={editingDateListId !== null}
                      onClick={() => void handleSavePurchaseDate(list.id)}
                    >
                      {editingDateListId === list.id ? "Salvando..." : "Salvar data"}
                    </Button>
                  </div>
                  <div className="actions-row mt-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={duplicatingListId !== null}
                      onClick={() => void handleDuplicateList(list.id)}
                    >
                      {duplicatingListId === list.id ? "Duplicando..." : "Duplicar na lista"}
                    </Button>
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
