import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NfceReviewDrawer } from "../NfceReviewDrawer";
import type { NfceParsedDocument } from "../../../domain/nfceParser";
import type { MatchReceiptResult } from "../../../domain/receiptMatcher";
import type { InventoryProduct, InventoryShoppingListItem } from "../../../features/inventory/types";

describe("NfceReviewDrawer", () => {
  const mockProduct: InventoryProduct = {
    id: "prod-1",
    name: "Arroz Branco 5kg",
    quantity: 1,
    minStock: 2,
    categoryId: "cat-1",
  };

  const mockListItem: InventoryShoppingListItem = {
    id: "list-item-1",
    productId: "prod-1",
    quantity: 2,
    checked: false,
    validityDate: "2027-01-10",
    naoAplicaValidade: false,
  };

  const mockParsedDoc: NfceParsedDocument = {
    chaveAcesso: "35261000000000000000652080000474581006519038",
    emitente: "MERCADO PAULISTA LTDA",
    cnpj: "12.345.678/0001-90",
    endereco: "Rua A, 100",
    dataEmissao: "2026-10-25T14:30:00",
    total: 35.8,
    itens: [
      {
        id: "nfce-item-1",
        codigo: "101",
        descricao: "ARROZ BRANCO 5KG TIPO 1",
        quantidade: 1,
        unidade: "UN",
        valorUnitario: 35.8,
        valorTotal: 35.8,
      },
    ],
  };

  const mockMatchResult: MatchReceiptResult = {
    matches: [
      {
        notaItem: mockParsedDoc.itens[0],
        listItem: mockListItem,
        product: mockProduct,
        confidence: 0.95,
        selected: true,
        proposedPrice: 35.8,
        proposedUnitPrice: 35.8,
        proposedQuantity: 1,
        proposedUnit: "Un",
        preserveValidityDate: "2027-01-10",
        preserveNaoAplica: false,
      },
    ],
    unmatchedNota: [],
    unmatchedList: [],
  };

  it("não deve renderizar nada quando open for false", () => {
    const { container } = render(
      <NfceReviewDrawer
        open={false}
        onClose={vi.fn()}
        parsedDoc={mockParsedDoc}
        matchResult={mockMatchResult}
        onConfirmFinalize={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar o cabeçalho, dados da nota e produtos casados com acessibilidade", () => {
    render(
      <NfceReviewDrawer
        open={true}
        onClose={vi.fn()}
        parsedDoc={mockParsedDoc}
        matchResult={mockMatchResult}
        onConfirmFinalize={vi.fn()}
      />,
    );

    expect(screen.getByText("Revisão da Nota Fiscal")).toBeInTheDocument();
    expect(screen.getByText(/MERCADO PAULISTA LTDA/)).toBeInTheDocument();
    expect(screen.getByText(/25\/10\/2026/)).toBeInTheDocument();
    expect(screen.getByText("Arroz Branco 5kg")).toBeInTheDocument();
    expect(screen.getByText("Validade: 10/01/2027")).toBeInTheDocument();

    const checkbox = screen.getByTestId("checkbox-match-list-item-1");
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute("aria-label", "Selecionar Arroz Branco 5kg");
    expect(checkbox).toBeChecked();
  });

  it("deve alternar a seleção do item ao clicar na checkbox ou no label acessível", () => {
    render(
      <NfceReviewDrawer
        open={true}
        onClose={vi.fn()}
        parsedDoc={mockParsedDoc}
        matchResult={mockMatchResult}
        onConfirmFinalize={vi.fn()}
      />,
    );

    const checkbox = screen.getByTestId("checkbox-match-list-item-1");
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();

    // Quando nenhum item estiver selecionado, botão Aplicar deve estar desabilitado
    const confirmBtn = screen.getByTestId("nfce-confirm-finalize-button");
    expect(confirmBtn).toBeDisabled();
  });

  it("deve chamar onConfirmFinalize com o payload correto ao confirmar", async () => {
    const handleConfirm = vi.fn().mockResolvedValue(undefined);

    render(
      <NfceReviewDrawer
        open={true}
        onClose={vi.fn()}
        parsedDoc={mockParsedDoc}
        matchResult={mockMatchResult}
        onConfirmFinalize={handleConfirm}
      />,
    );

    const confirmBtn = screen.getByTestId("nfce-confirm-finalize-button");
    fireEvent.click(confirmBtn);

    expect(handleConfirm).toHaveBeenCalledTimes(1);
    expect(handleConfirm).toHaveBeenCalledWith({
      purchaseDate: "2026-10-25",
      marketName: "MERCADO PAULISTA LTDA",
      matchedItemsToUpdate: [
        {
          listItemId: "list-item-1",
          listItemName: "Arroz Branco 5kg",
          receiptName: "ARROZ BRANCO 5KG TIPO 1",
          unitPrice: 35.8,
          totalPrice: 35.8,
          quantity: 1,
          unit: "Un",
          validityDate: "2027-01-10",
          naoAplicaValidade: false,
        },
      ],
      newItemsToAdd: [],
    });
  });

  it("deve chamar onClose ao clicar no botão Cancelar", () => {
    const handleClose = vi.fn();

    render(
      <NfceReviewDrawer
        open={true}
        onClose={handleClose}
        parsedDoc={mockParsedDoc}
        matchResult={mockMatchResult}
        onConfirmFinalize={vi.fn()}
      />,
    );

    const cancelBtn = screen.getByText("Cancelar");
    fireEvent.click(cancelBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
