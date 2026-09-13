import { useEffect, useState, useCallback, useMemo, useRef, type ReactElement } from "react";
import { Drawer } from "../Drawer/Drawer";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import {
  resolveTendaBranchByCep,
  quoteShoppingItemOnTenda,
  type TendaBranchInfo,
  type TendaItemQuote,
  type TendaProduct,
} from "../../services/tendaService";

export interface ShoppingQuoteItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  currentPrice: number | null;
}

interface TendaPriceDrawerProps {
  open: boolean;
  onClose: () => void;
  items: ShoppingQuoteItem[];
  defaultCep?: string;
  onApplyPrice?: (itemId: string, price: number) => void;
  onApplyAllPrices?: (updates: { itemId: string; price: number }[]) => void;
}

/**
 * Gaveta lateral para cotação de preços de itens da lista de compras no Tenda Atacado.
 * Permite buscar os produtos mais baratos para um CEP específico e conferir links oficiais.
 *
 * @param props.open - Indica se a gaveta está visível
 * @param props.onClose - Callback ao fechar a gaveta
 * @param props.items - Itens da lista de compras para cotação
 * @param props.defaultCep - CEP inicial para consulta
 * @param props.onApplyPrice - Callback para aplicar o preço de um item
 * @param props.onApplyAllPrices - Callback para aplicar todos os preços cotados
 */
export const TendaPriceDrawer = ({
  open,
  onClose,
  items,
  defaultCep = "13064-789",
  onApplyPrice,
  onApplyAllPrices,
}: TendaPriceDrawerProps): ReactElement => {
  const [cep, setCep] = useState<string>(defaultCep);
  const [branchInfo, setBranchInfo] = useState<TendaBranchInfo | null>(null);
  const [loadingBranch, setLoadingBranch] = useState<boolean>(false);
  const [branchError, setBranchError] = useState<string | null>(null);

  const [quotes, setQuotes] = useState<Record<string, TendaItemQuote>>({});
  const [loadingQuotes, setLoadingQuotes] = useState<Record<string, boolean>>({});
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const hasFetchedRef = useRef<boolean>(false);
  const isQuotingRef = useRef<boolean>(false);

  const startQuoting = useCallback(
    async (targetCep: string, bypassCache = false): Promise<void> => {
      if (isQuotingRef.current) return;
      isQuotingRef.current = true;

      setLoadingBranch(true);
      setBranchError(null);

      let info: TendaBranchInfo | null = null;
      try {
        info = await resolveTendaBranchByCep(targetCep, undefined, bypassCache);
        setBranchInfo(info);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Erro ao consultar filial para este CEP";
        setBranchError(message);
        setBranchInfo(null);
        setLoadingBranch(false);
        isQuotingRef.current = false;
        return;
      } finally {
        setLoadingBranch(false);
      }

      if (!info?.branchId) {
        isQuotingRef.current = false;
        return;
      }

      const initialLoading: Record<string, boolean> = {};
      for (const item of items) {
        initialLoading[item.id] = true;
      }
      setLoadingQuotes(initialLoading);

      const activeBranchId = info.branchId;

      for (const item of items) {
        if (!hasFetchedRef.current) break;
        try {
          const quote = await quoteShoppingItemOnTenda(
            item.name,
            activeBranchId,
            undefined,
            bypassCache,
          );
          setQuotes((prev) => ({ ...prev, [item.id]: quote }));
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : "Erro ao cotar";
          setQuotes((prev) => ({
            ...prev,
            [item.id]: {
              itemName: item.name,
              baseProduct: item.name,
              requestedBrand: null,
              sameBrandOffer: null,
              cheaperAlternativeOffer: null,
              targetSize: null,
              startingFromPrice: null,
              recommended: null,
              options: [],
              totalFound: 0,
              error: message,
            },
          }));
        } finally {
          setLoadingQuotes((prev) => ({ ...prev, [item.id]: false }));
        }

        await new Promise((resolve) => setTimeout(resolve, 250));
      }

      isQuotingRef.current = false;
    },
    [items],
  );

  const handleQuoteSingle = useCallback(
    async (item: ShoppingQuoteItem, bypassCache = true): Promise<void> => {
      if (!branchInfo) return;
      setLoadingQuotes((prev) => ({ ...prev, [item.id]: true }));
      try {
        const quote = await quoteShoppingItemOnTenda(
          item.name,
          branchInfo.branchId,
          undefined,
          bypassCache,
        );
        setQuotes((prev) => ({ ...prev, [item.id]: quote }));
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro ao cotar";
        setQuotes((prev) => ({
          ...prev,
          [item.id]: {
            itemName: item.name,
            baseProduct: item.name,
            requestedBrand: null,
            sameBrandOffer: null,
            cheaperAlternativeOffer: null,
            targetSize: null,
            startingFromPrice: null,
            recommended: null,
            options: [],
            totalFound: 0,
            error: message,
          },
        }));
      } finally {
        setLoadingQuotes((prev) => ({ ...prev, [item.id]: false }));
      }
    },
    [branchInfo],
  );

  useEffect(() => {
    if (open) {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        void startQuoting(cep);
      }
    } else {
      hasFetchedRef.current = false;
      isQuotingRef.current = false;
    }
  }, [open, cep, startQuoting]);

  const totalEstimated = useMemo(() => {
    let sum = 0;
    for (const item of items) {
      const quote = quotes[item.id];
      if (quote?.startingFromPrice) {
        sum += quote.startingFromPrice * (item.quantity > 0 ? item.quantity : 1);
      }
    }
    return sum;
  }, [items, quotes]);

  const itemsWithQuoteCount = useMemo(() => {
    return items.filter((item) => Boolean(quotes[item.id]?.startingFromPrice)).length;
  }, [items, quotes]);

  const handleApplyAll = (): void => {
    if (!onApplyAllPrices) return;
    const updates: { itemId: string; price: number }[] = [];
    for (const item of items) {
      const q = quotes[item.id];
      if (q?.startingFromPrice) {
        updates.push({ itemId: item.id, price: q.startingFromPrice });
      }
    }
    onApplyAllPrices(updates);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Cotação Tenda Atacado"
      subtitle="Preços e disponibilidade para entrega"
      width="w-full max-w-md sm:max-w-lg"
      testId="tenda-price-drawer"
    >
      <div className="flex flex-col gap-4 p-4 text-sm">
        {/* Bloco de CEP e Filial */}
        <div className="rounded-lg border border-base-300 bg-base-100 p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-base-content/70">CEP de Entrega:</span>
            <input
              type="text"
              value={cep}
              onChange={(e) => setCep(e.target.value)}
              placeholder="00000-000"
              className="input input-xs input-bordered w-28 font-mono text-center"
            />
            <Button
              size="sm"
              variant="secondary"
              className="btn-xs"
              disabled={loadingBranch}
              onClick={() => {
                void startQuoting(cep);
              }}
            >
              {loadingBranch ? (
                <span className="loading loading-spinner loading-xs" />
              ) : (
                "Consultar"
              )}
            </Button>
          </div>

          {branchError && <div className="mt-2 text-xs text-error">{branchError}</div>}

          {branchInfo && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="primary" size="sm">
                Loja: {branchInfo.branchName}
              </Badge>
              <Badge variant="default" size="sm">
                Frete: R$ {branchInfo.deliveryPrice.toFixed(2)}
              </Badge>
              {branchInfo.deliveryDays > 0 && (
                <span className="text-base-content/70">Prazo: {branchInfo.deliveryDays} dias</span>
              )}
              <span className="text-[11px] text-base-content/50">
                (Preços válidos até as 23:59 de hoje)
              </span>
            </div>
          )}
        </div>

        {/* Ações e Resumo */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-base-content/70">
            {itemsWithQuoteCount} de {items.length} itens cotados
          </span>
          <div className="flex gap-2">
            {branchInfo && (
              <Button
                size="sm"
                variant="ghost"
                className="btn-xs"
                onClick={() => {
                  void startQuoting(cep, true);
                }}
              >
                Recotar Todos
              </Button>
            )}
            {onApplyAllPrices && itemsWithQuoteCount > 0 && (
              <Button size="sm" variant="primary" className="btn-xs" onClick={handleApplyAll}>
                Aplicar Preços na Lista
              </Button>
            )}
          </div>
        </div>

        {/* Lista de Itens */}
        <div className="flex flex-col gap-3">
          {items.map((item) => {
            const quote = quotes[item.id];
            const isLoading = loadingQuotes[item.id];
            const isExpanded = expandedItemId === item.id;

            return (
              <div
                key={item.id}
                className="flex flex-col rounded-lg border border-base-200 bg-base-100 p-3 shadow-sm transition-all"
              >
                {/* Linha principal do item */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-base-content">{item.name}</div>
                    <div className="text-xs text-base-content/60">
                      Qtd: {item.quantity} {item.unit}
                      {item.currentPrice != null && (
                        <span> | Atual: R$ {item.currentPrice.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {isLoading ? (
                    <span className="loading loading-spinner loading-xs text-primary" />
                  ) : quote?.startingFromPrice ? (
                    <div className="text-right">
                      <div className="text-xs text-base-content/60">A partir de</div>
                      <div className="font-mono text-base font-bold text-success">
                        R$ {quote.startingFromPrice.toFixed(2)}
                      </div>
                    </div>
                  ) : quote?.error ? (
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-error font-medium">{quote.error}</span>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-primary p-0 h-auto min-h-0 underline"
                        onClick={() => void handleQuoteSingle(item)}
                      >
                        Tentar novamente
                      </button>
                    </div>
                  ) : (
                    <Badge variant="default" size="sm">
                      Sem ofertas
                    </Badge>
                  )}
                </div>

                {/* Card da melhor oferta */}
                {quote?.recommended && (
                  <div className="mt-2 rounded-md bg-base-200/50 p-2 text-xs">
                    <div className="flex items-center gap-2">
                      {quote.recommended.thumbnail && (
                        <img
                          src={quote.recommended.thumbnail}
                          alt={quote.recommended.name}
                          className="h-10 w-10 rounded object-contain bg-white p-0.5"
                          loading="lazy"
                        />
                      )}
                      <div className="flex-1 overflow-hidden">
                        <div
                          className="truncate font-medium text-base-content"
                          title={quote.recommended.name}
                        >
                          {quote.recommended.name}
                        </div>
                        <div className="text-base-content/70">
                          {quote.recommended.brand} - R$ {quote.recommended.price.toFixed(2)}
                        </div>
                        {quote.recommended.wholesalePrices &&
                          quote.recommended.wholesalePrices.length > 0 && (
                            <div className="text-primary font-medium">
                              Atacado: R$ {quote.recommended.wholesalePrices[0].price.toFixed(2)} (a
                              partir de {quote.recommended.wholesalePrices[0].minQuantity} un)
                            </div>
                          )}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2 border-t border-base-300 pt-2">
                      <a
                        href={quote.recommended.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link link-primary inline-flex items-center gap-1 text-xs"
                      >
                        Conferir no Tenda ↗
                      </a>

                      <div className="flex items-center gap-2">
                        {quote.options.length > 1 && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-xs text-base-content/70"
                            onClick={() => setExpandedItemId(isExpanded ? null : item.id)}
                          >
                            {isExpanded ? "Ocultar opções" : `+${quote.options.length - 1} opções`}
                          </button>
                        )}
                        {onApplyPrice && (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="btn-xs"
                            onClick={() => onApplyPrice(item.id, quote.recommended!.price)}
                          >
                            Usar Preço
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Alerta de economia com marca alternativa */}
                    {quote.cheaperAlternativeOffer && (
                      <div className="mt-2 rounded-md bg-success/10 p-2.5 text-xs border border-success/20 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between font-medium text-success-content">
                          <span className="flex items-center gap-1 font-semibold">
                            <span>🤑</span> Alternativa mais barata (
                            {quote.cheaperAlternativeOffer.brand}):
                          </span>
                          <span className="font-mono font-bold">
                            R$ {quote.cheaperAlternativeOffer.price.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="text-base-content/80 text-[11px] truncate"
                          title={quote.cheaperAlternativeOffer.name}
                        >
                          {quote.cheaperAlternativeOffer.name}
                        </div>
                        <div className="flex items-center justify-between pt-1 border-t border-success/10 text-success-content/90 text-[11px]">
                          <span className="font-medium">
                            Economia de R${" "}
                            {(
                              quote.recommended.price - quote.cheaperAlternativeOffer.price
                            ).toFixed(2)}{" "}
                            (
                            {(
                              100 -
                              (quote.cheaperAlternativeOffer.price / quote.recommended.price) * 100
                            ).toFixed(0)}
                            %)
                          </span>
                          <div className="flex items-center gap-2">
                            <a
                              href={quote.cheaperAlternativeOffer.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link link-primary text-xs"
                            >
                              Ver ↗
                            </a>
                            {onApplyPrice && (
                              <button
                                type="button"
                                className="btn btn-xs btn-success text-white px-2 h-6 min-h-0"
                                onClick={() =>
                                  onApplyPrice(item.id, quote.cheaperAlternativeOffer!.price)
                                }
                              >
                                Trocar Marca
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Lista expandida de alternativas mais baratas */}
                    {isExpanded && (
                      <div className="mt-2 flex flex-col gap-1.5 border-t border-base-300 pt-2">
                        <div className="font-semibold text-base-content/80 text-xs">
                          Outras opções disponíveis:
                        </div>
                        {quote.options.slice(1).map((opt: TendaProduct) => (
                          <div
                            key={opt.id}
                            className="flex items-center justify-between rounded bg-base-100 p-1.5"
                          >
                            <div className="truncate pr-2">
                              <span className="font-medium">{opt.name}</span>
                              <span className="text-base-content/60"> ({opt.brand})</span>
                            </div>
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <span className="font-mono font-semibold">
                                R$ {opt.price.toFixed(2)}
                              </span>
                              <a
                                href={opt.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-ghost btn-xs text-primary"
                              >
                                Ver ↗
                              </a>
                              {onApplyPrice && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-xs"
                                  onClick={() => onApplyPrice(item.id, opt.price)}
                                >
                                  Usar
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Rodapé com Total Estimado */}
        {totalEstimated > 0 && (
          <div className="sticky bottom-0 -mx-4 -mb-4 mt-2 border-t border-base-300 bg-base-100 p-4 shadow-lg">
            <div className="flex items-center justify-between text-xs text-base-content/70">
              <span>Subtotal dos itens cotados:</span>
              <span className="font-mono font-medium">R$ {totalEstimated.toFixed(2)}</span>
            </div>
            {branchInfo && branchInfo.deliveryPrice > 0 && (
              <div className="flex items-center justify-between text-xs text-base-content/70">
                <span>Frete estimado ({branchInfo.branchName}):</span>
                <span className="font-mono font-medium">
                  R$ {branchInfo.deliveryPrice.toFixed(2)}
                </span>
              </div>
            )}
            <div className="mt-1 flex items-center justify-between border-t border-base-200 pt-1 text-sm font-bold text-base-content">
              <span>Total Estimado:</span>
              <span className="font-mono text-base text-primary">
                R$ {(totalEstimated + (branchInfo?.deliveryPrice ?? 0)).toFixed(2)}
              </span>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};
