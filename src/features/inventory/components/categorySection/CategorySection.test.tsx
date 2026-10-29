import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CategorySection } from "./CategorySection";
import { StockView } from "../stockView/StockView";
import { ShoppingListView } from "../shoppingListView/ShoppingListView";
import type { InventoryCategory, InventoryProduct, InventoryShoppingListItem } from "../../types";

const products: InventoryProduct[] = [
  {
    id: "prod-1",
    name: "Arroz Branco 5kg",
    quantity: 2,
    minStock: 4,
    categoryId: "cat-1",
    unit: "Un",
  },
  {
    id: "prod-2",
    name: "Feijão Carioca 1kg",
    quantity: 3,
    minStock: 2,
    categoryId: "cat-1",
    unit: "Un",
  },
];

const categories: InventoryCategory[] = [
  { id: "cat-1", name: "🌾 Grãos", order: 1 },
];

const shoppingList: InventoryShoppingListItem[] = [
  {
    id: "item-1",
    productId: "prod-1",
    quantity: 1,
    checked: true,
    price: 25.9,
  },
];

describe("CategorySection, StockView e ShoppingListView (#46)", () => {
  it("renderiza todos os produtos da categoria no container de grid e permite recolher/expandir a seção", () => {
    render(
      <CategorySection
        name="🌾 Grãos"
        products={products}
        onEdit={vi.fn()}
        onAddToList={vi.fn()}
        onRemove={vi.fn()}
        onConsume={vi.fn()}
        onOpenCustomConsume={vi.fn()}
      />,
    );

    const grid = screen.getByTestId("category-products-grid");
    expect(within(grid).getByText("Arroz Branco 5kg")).toBeInTheDocument();
    expect(within(grid).getByText("Feijão Carioca 1kg")).toBeInTheDocument();
    expect(screen.getByText("1 baixo")).toBeInTheDocument();

    const toggleButton = screen.getByRole("button", { name: /Grãos/i });
    fireEvent.click(toggleButton);
    expect(screen.queryByTestId("category-products-grid")).not.toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(screen.getByTestId("category-products-grid")).toBeInTheDocument();
  });

  it("exibe as seções de categorias e contadores de estoque baixo no StockView", () => {
    render(
      <StockView
        products={products}
        categories={categories}
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
      />,
    );

    expect(screen.getByTestId("stock-heading")).toHaveTextContent("Estoque");
    expect(screen.getByText(/1 baixo · 0 zerado/i)).toBeInTheDocument();
    expect(screen.getByTestId("category-products-grid")).toBeInTheDocument();
  });

  it("exibe os itens da lista de compras e aciona a finalização quando há itens marcados", () => {
    const onFinalizeShopping = vi.fn();

    render(
      <ShoppingListView
        products={products}
        shoppingList={shoppingList}
        checkedCount={1}
        uncheckedCount={0}
        onSmartAdd={vi.fn()}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onGenerateSmartList={vi.fn()}
        onFinalizeShopping={onFinalizeShopping}
        smartInput=""
        onSmartInputChange={vi.fn()}
      />,
    );

    expect(screen.getByTestId("shopping-list-heading")).toHaveTextContent("Lista de Compras");
    expect(screen.getByText("Arroz Branco 5kg")).toBeInTheDocument();

    const finalizeButton = screen.getByTestId("finalize-shopping-button");
    expect(finalizeButton).toBeEnabled();
    fireEvent.click(finalizeButton);
    expect(onFinalizeShopping).toHaveBeenCalledTimes(1);
  });
});
