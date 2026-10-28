import { render, screen } from "@testing-library/react";
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

describe("CategorySection, StockView e ShoppingListView - Responsividade Tablet e Desktop (#46)", () => {
  it("renderiza os cards de produtos em um grid responsivo multi-colunas (grid-cols-1 md:grid-cols-2 xl:grid-cols-3)", () => {
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
    expect(grid).toBeInTheDocument();
    expect(grid.className).toContain("grid");
    expect(grid.className).toContain("grid-cols-1");
    expect(grid.className).toContain("md:grid-cols-2");
    expect(grid.className).toContain("xl:grid-cols-3");
    expect(grid.className).toContain("gap-3");
  });

  it("aplica container max-w-6xl mx-auto no StockView", () => {
    const { container } = render(
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

    const root = container.firstElementChild;
    expect(root?.className).toContain("max-w-6xl");
    expect(root?.className).toContain("mx-auto");
    expect(root?.className).toContain("w-full");
  });

  it("aplica container max-w-4xl mx-auto no ShoppingListView e na barra de finalizar compra", () => {
    const { container } = render(
      <ShoppingListView
        products={products}
        shoppingList={shoppingList}
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

    const root = container.firstElementChild;
    expect(root?.className).toContain("max-w-4xl");
    expect(root?.className).toContain("mx-auto");
    expect(root?.className).toContain("w-full");

    const finalizeButton = screen.getByTestId("finalize-shopping-button");
    expect(finalizeButton.parentElement?.className).toContain("max-w-4xl");
    expect(finalizeButton.parentElement?.className).toContain("mx-auto");
  });
});
