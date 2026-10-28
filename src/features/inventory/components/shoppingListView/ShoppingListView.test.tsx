import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ShoppingListView } from "./ShoppingListView";
import { StockView } from "../stockView/StockView";
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
];

describe("Prevenção de sobreposição de camadas flutuantes (Issue #48)", () => {
  it("renderiza container docked com fundo translúcido e borda superior para o botão Finalizar compra e aplica pb-40 na lista", () => {
    render(
      <ShoppingListView
        products={mockProducts}
        shoppingList={mockShoppingList}
        checkedCount={1}
        uncheckedCount={0}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={vi.fn()}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    const listContainer = screen.getByTestId("shopping-list-items-container");
    expect(listContainer.className).toContain("pb-40");

    const finalizeContainer = screen.getByTestId("finalize-shopping-container");
    expect(finalizeContainer.className).toContain("bg-base-100/95");
    expect(finalizeContainer.className).toContain("backdrop-blur");
    expect(finalizeContainer.className).toContain("border-t");
    expect(finalizeContainer.className).toContain("border-base-300");
    expect(screen.getByTestId("finalize-shopping-button")).toBeInTheDocument();
  });

  it("oculta o container de Finalizar compra quando não há itens marcados e mantém pb-36 na lista", () => {
    render(
      <ShoppingListView
        products={mockProducts}
        shoppingList={[{ ...mockShoppingList[0], checked: false }]}
        checkedCount={0}
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

    const listContainer = screen.getByTestId("shopping-list-items-container");
    expect(listContainer.className).toContain("pb-36");
    expect(screen.queryByTestId("finalize-shopping-container")).not.toBeInTheDocument();
  });

  it("aplica pb-40 no container rolável do StockView para evitar sobreposição do FAB da câmera", () => {
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

    const stockContainer = screen.getByTestId("stock-items-container");
    expect(stockContainer.className).toContain("pb-40");
  });
});
