import { useState, useMemo, type ReactElement } from "react";
import { Drawer } from "../Drawer/Drawer";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import { Checkbox } from "../Checkbox/Checkbox";
import { formatIsoDateToPtBr, getLocalDateString, type NfceParsedDocument } from "../../domain/nfceParser";
import type {
  MatchReceiptResult,
  MatchedReceiptItem,
  UnmatchedNotaItem,
} from "../../domain/receiptMatcher";
import type { Unit } from "../../types/inventory.types";

export interface NfceFinalizePayload {
  purchaseDate: string;
  marketName: string;
  matchedItemsToUpdate: {
    listItemId: string;
    listItemName: string;
    receiptName: string;
    unitPrice: number;
    totalPrice: number;
    quantity: number;
    unit: Unit;
    validityDate: string | null;
    naoAplicaValidade: boolean;
  }[];
  newItemsToAdd: {
    name: string;
    unitPrice: number;
    totalPrice: number;
    quantity: number;
    unit: Unit;
  }[];
}

interface NfceReviewDrawerProps {
  open: boolean;
  onClose: () => void;
  parsedDoc: NfceParsedDocument | null;
  matchResult: MatchReceiptResult | null;
  onConfirmFinalize: (payload: NfceFinalizePayload) => Promise<void>;
  loading?: boolean;
}

/**
 * Gaveta (Drawer / Bottom Sheet) de conferência dos itens extraídos da NFC-e
 * antes de atualizar e finalizar a lista de compras.
 *
 * @param props.open - Indica se a gaveta está visível
 * @param props.onClose - Callback disparado ao fechar a gaveta
 * @param props.parsedDoc - Dados estruturados extraídos da nota fiscal
 * @param props.matchResult - Resultado da correspondência entre nota e lista de compras
 * @param props.onConfirmFinalize - Callback assíncrono para aplicar as mudanças e finalizar a lista
 * @param props.loading - Indica se o processo de finalização está em execução
 * @returns Elemento React da gaveta de revisão ou null
 */
export const NfceReviewDrawer = ({
  open,
  onClose,
  parsedDoc,
  matchResult,
  onConfirmFinalize,
  loading = false,
}: NfceReviewDrawerProps): ReactElement | null => {
  const [deselectedMatches, setDeselectedMatches] = useState<Record<string, boolean>>({});
  const [deselectedNewItems, setDeselectedNewItems] = useState<Record<string, boolean>>({});

  const toggleMatch = (listItemId: string): void => {
    setDeselectedMatches((prev) => ({
      ...prev,
      [listItemId]: !prev[listItemId],
    }));
  };

  const toggleNewItem = (notaItemId: string): void => {
    setDeselectedNewItems((prev) => ({
      ...prev,
      [notaItemId]: !prev[notaItemId],
    }));
  };

  const isMatchSelected = (listItemId: string): boolean => !deselectedMatches[listItemId];
  const isNewItemSelected = (notaItemId: string): boolean => !deselectedNewItems[notaItemId];

  const { totalSelected, selectedCount } = useMemo(() => {
    if (!matchResult) return { totalSelected: 0, selectedCount: 0 };

    let sum = 0;
    let count = 0;

    for (const m of matchResult.matches) {
      if (!deselectedMatches[m.listItem.id]) {
        sum += m.proposedPrice;
        count++;
      }
    }

    for (const u of matchResult.unmatchedNota) {
      if (!deselectedNewItems[u.notaItem.id]) {
        sum += u.proposedPrice;
        count++;
      }
    }

    return { totalSelected: sum, selectedCount: count };
  }, [matchResult, deselectedMatches, deselectedNewItems]);

  const handleConfirm = async (): Promise<void> => {
    if (!matchResult || !parsedDoc) return;

    const matchedItemsToUpdate = matchResult.matches
      .filter((m) => isMatchSelected(m.listItem.id))
      .map((m) => ({
        listItemId: m.listItem.id,
        listItemName: m.product.name,
        receiptName: m.notaItem.descricao,
        unitPrice: m.proposedUnitPrice,
        totalPrice: m.proposedPrice,
        quantity: m.proposedQuantity,
        unit: m.proposedUnit,
        validityDate: m.preserveValidityDate,
        naoAplicaValidade: m.preserveNaoAplica,
      }));

    const newItemsToAdd = matchResult.unmatchedNota
      .filter((u) => isNewItemSelected(u.notaItem.id))
      .map((u) => ({
        name: u.notaItem.descricao,
        unitPrice: u.proposedUnitPrice,
        totalPrice: u.proposedPrice,
        quantity: u.proposedQuantity,
        unit: u.proposedUnit,
      }));

    const purchaseDate = parsedDoc.dataEmissao
      ? parsedDoc.dataEmissao.slice(0, 10)
      : getLocalDateString();

    await onConfirmFinalize({
      purchaseDate,
      marketName: parsedDoc.emitente,
      matchedItemsToUpdate,
      newItemsToAdd,
    });
  };

  if (!open || !parsedDoc || !matchResult) return null;

  const formattedEmissionDate = parsedDoc.dataEmissao
    ? formatIsoDateToPtBr(parsedDoc.dataEmissao)
    : "Data de hoje";

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Revisão da Nota Fiscal"
      subtitle={`${parsedDoc.emitente} • ${formattedEmissionDate}`}
      width="w-full sm:w-[540px] md:w-[620px]"
      testId="nfce-review-drawer"
    >
      <div className="flex flex-col gap-6 pb-24">
        <div className="bg-base-200/80 rounded-2xl p-4 border border-base-300 flex justify-between items-center">
          <div>
            <div className="text-xs text-base-content/60 uppercase font-semibold">Valor da Nota</div>
            <div className="text-2xl font-black text-primary">
              {parsedDoc.total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-base-content/60 uppercase font-semibold">Itens na Nota</div>
            <div className="text-lg font-bold text-base-content">
              {parsedDoc.itens.length} produtos
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-base text-base-content">Casados com sua lista</h4>
              <span data-testid="badge-matched-count">
                <Badge variant="success" size="sm">
                  {matchResult.matches.length}
                </Badge>
              </span>
            </div>
            <span className="text-xs text-base-content/50">Validades mantidas</span>
          </div>

          {matchResult.matches.length === 0 ? (
            <div className="text-sm text-base-content/60 p-4 bg-base-200/40 rounded-xl text-center">
              Nenhum item da lista foi encontrado na nota fiscal.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {matchResult.matches.map((m: MatchedReceiptItem) => {
                const isChecked = isMatchSelected(m.listItem.id);
                return (
                  <label
                    key={m.listItem.id}
                    data-testid={`matched-item-${m.listItem.id}`}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 focus-within:ring-2 focus-within:ring-primary ${
                      isChecked
                        ? "bg-base-100 border-success/40 shadow-xs"
                        : "bg-base-200/40 border-base-300 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onChange={() => toggleMatch(m.listItem.id)}
                        aria-label={`Selecionar ${m.product.name}`}
                        data-testid={`checkbox-match-${m.listItem.id}`}
                      />
                      <div className="truncate">
                        <div className="font-semibold text-sm text-base-content truncate">
                          {m.product.name}
                        </div>
                        <div className="text-xs text-base-content/50 truncate">
                          Cupom: {m.notaItem.descricao}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {m.preserveValidityDate ? (
                            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-medium">
                              Validade: {formatIsoDateToPtBr(m.preserveValidityDate)}
                            </span>
                          ) : m.preserveNaoAplica ? (
                            <span className="text-[10px] bg-base-300 text-base-content/70 px-1.5 py-0.5 rounded-sm font-medium">
                              Não se aplica
                            </span>
                          ) : (
                            <span className="text-[10px] bg-warning/10 text-warning px-1.5 py-0.5 rounded-sm font-medium">
                              Pendente validade
                            </span>
                          )}
                          <span className="text-xs text-base-content/60">
                            {m.proposedQuantity} {m.proposedUnit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-base-content">
                        {m.proposedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                      <div className="text-[10px] text-base-content/50">
                        {m.proposedUnitPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/un
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {matchResult.unmatchedNota.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-base text-base-content">Novos no carrinho</h4>
                <span data-testid="badge-unmatched-nota-count">
                  <Badge variant="info" size="sm">
                    {matchResult.unmatchedNota.length}
                  </Badge>
                </span>
              </div>
              <span className="text-xs text-base-content/50">Serão adicionados na lista</span>
            </div>

            <div className="flex flex-col gap-2">
              {matchResult.unmatchedNota.map((u: UnmatchedNotaItem) => {
                const isChecked = isNewItemSelected(u.notaItem.id);
                return (
                  <label
                    key={u.notaItem.id}
                    data-testid={`unmatched-item-${u.notaItem.id}`}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 focus-within:ring-2 focus-within:ring-primary ${
                      isChecked
                        ? "bg-base-100 border-info/40 shadow-xs"
                        : "bg-base-200/40 border-base-300 opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Checkbox
                        checked={isChecked}
                        onChange={() => toggleNewItem(u.notaItem.id)}
                        aria-label={`Selecionar item novo ${u.notaItem.descricao}`}
                        data-testid={`checkbox-new-${u.notaItem.id}`}
                      />
                      <div className="truncate">
                        <div className="font-semibold text-sm text-base-content truncate">
                          {u.notaItem.descricao}
                        </div>
                        <div className="text-xs text-base-content/50">
                          {u.proposedQuantity} {u.proposedUnit} • Cód: {u.notaItem.codigo}
                        </div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-sm text-base-content">
                        {u.proposedPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {matchResult.unmatchedList.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-base text-base-content/70">Não encontrados na nota</h4>
                <Badge variant="default" size="sm">
                  {matchResult.unmatchedList.length}
                </Badge>
              </div>
              <span className="text-xs text-base-content/40">Continuarão na lista</span>
            </div>

            <div className="p-3 bg-base-200/40 rounded-xl border border-base-300 text-xs text-base-content/60 flex flex-col gap-1">
              {matchResult.unmatchedList.map((ul) => (
                <div key={ul.listItem.id} className="flex justify-between py-0.5">
                  <span>• {ul.product.name}</span>
                  <span>{ul.listItem.quantity}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-base-300 bg-base-100/90 backdrop-blur-md fixed bottom-0 left-0 right-0 z-30 flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] text-base-content/60 uppercase font-semibold">
            Selecionados ({selectedCount})
          </div>
          <div className="text-lg font-black text-base-content">
            {totalSelected.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading || selectedCount === 0}
            data-testid="nfce-confirm-finalize-button"
            className="shadow-md"
          >
            {loading ? "Aplicando na lista..." : "Aplicar na Lista"}
          </Button>
        </div>
      </div>
    </Drawer>
  );
};
