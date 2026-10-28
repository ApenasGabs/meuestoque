import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ShoppingListView } from "./ShoppingListView";
import { StockView } from "../stockView/StockView";
import { useBulkStore } from "../../../../stores/bulkStore";
import type { InventoryCategory, InventoryProduct, InventoryShoppingListItem } from "../../types";

const mockProducts: InventoryProduct[] = [
  {
    id: "prod-1",
    name: "Arroz Agulhinha 5kg",
    quantity: 2,
    minStock: 1,
    categoryId: "cat-1",
    unit: "Un",
  },
  {
    id: "prod-2",
    name: "Detergente Neutro",
    quantity: 1,
    minStock: 2,
    categoryId: "cat-1",
    unit: "Un",
  },
];

const mockCategories: InventoryCategory[] = [
  {
    id: "cat-1",
    name: "Grãos",
    order: 1,
  },
];

const mockShoppingList: InventoryShoppingListItem[] = [
  {
    id: "item-1",
    productId: "prod-1",
    quantity: 2,
    checked: true,
    price: 28.9,
  },
  {
    id: "item-2",
    productId: "prod-2",
    quantity: 1,
    checked: false,
    price: 2.99,
  },
];

describe("ShoppingListView e StockView - Barra de finalização e ações dos cards finais (Issue #48)", () => {
  beforeEach(() => {
    useBulkStore.getState().exitBulkMode();
  });

  it("exibe o botão Finalizar compra acionável quando há itens marcados e mantém o último card da lista interativo", () => {
    const onFinalize = vi.fn();
    const onToggle = vi.fn();

    render(
      <ShoppingListView
        products={mockProducts}
        shoppingList={mockShoppingList}
        checkedCount={1}
        uncheckedCount={1}
        onSmartAdd={vi.fn()}
        onToggle={onToggle}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={onFinalize}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    const lastCardCheckbox = screen.getByRole("checkbox", {
      name: /Marcar Detergente Neutro/i,
    });
    fireEvent.click(lastCardCheckbox);
    expect(onToggle).toHaveBeenCalledWith("item-2");

    const finalizeButton = screen.getByRole("button", { name: /Finalizar compra/i });
    expect(finalizeButton).toBeEnabled();
    fireEvent.click(finalizeButton);
    expect(onFinalize).toHaveBeenCalledTimes(1);
  });

  it("oculta o dock de Finalizar compra quando não há itens marcados e o exibe ao marcar o primeiro item", () => {
    const onFinalize = vi.fn();
    const uncheckedList = mockShoppingList.map((item) => ({ ...item, checked: false }));

    const { rerender } = render(
      <ShoppingListView
        products={mockProducts}
        shoppingList={uncheckedList}
        checkedCount={0}
        uncheckedCount={2}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={onFinalize}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Finalizar compra/i })).not.toBeInTheDocument();

    rerender(
      <ShoppingListView
        products={mockProducts}
        shoppingList={mockShoppingList}
        checkedCount={1}
        uncheckedCount={1}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={onFinalize}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Finalizar compra/i })).toBeInTheDocument();
  });

  it("não renderiza o dock de Finalizar compra quando onFinalizeShopping não é fornecido ou quando o modo em lote está ativo", () => {
    const { rerender } = render(
      <ShoppingListView
        products={mockProducts}
        shoppingList={mockShoppingList}
        checkedCount={1}
        uncheckedCount={1}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Finalizar compra/i })).not.toBeInTheDocument();

    act(() => {
      useBulkStore.getState().enterBulkMode("shopping_list", "item-1");
    });

    rerender(
      <ShoppingListView
        products={mockProducts}
        shoppingList={mockShoppingList}
        checkedCount={1}
        uncheckedCount={1}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={vi.fn()}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Finalizar compra/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Definir Validade/i })).toBeInTheDocument();
  });

  it("mantém os botões de ação (Editar e Remover) do último card do estoque acessíveis e abre a confirmação de remoção", () => {
    render(
      <MemoryRouter>
        <StockView
          products={mockProducts}
          categories={mockCategories}
          search=""
          filters={[]}
          onSearchChange={vi.fn()}
          onToggleFilter={vi.fn()}
          onClearFilters={vi.fn()}
          onAddProduct={vi.fn()}
          onUpdateProduct={vi.fn()}
          onRemoveProduct={vi.fn()}
          onAddToShoppingList={vi.fn()}
          onAddCategory={vi.fn()}
        />
      </MemoryRouter>,
    );

    const removeLastCardBtn = screen.getByRole("button", {
      name: /Remover Detergente Neutro/i,
    });
    fireEvent.click(removeLastCardBtn);

    expect(screen.getByText("Remover produto")).toBeInTheDocument();
  });
});
