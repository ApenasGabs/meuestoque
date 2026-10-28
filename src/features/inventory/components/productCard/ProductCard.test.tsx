import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProductCard } from "./ProductCard";
import type { InventoryProduct } from "../../types";

const product: InventoryProduct = {
  id: "prod-1",
  name: "Arroz Branco 5kg",
  quantity: 2,
  minStock: 4,
  categoryId: "Outros",
  unit: "Un",
};

const renderCard = (): void => {
  render(
    <ProductCard
      product={product}
      onEdit={vi.fn()}
      onAddToList={vi.fn()}
      onRemove={vi.fn()}
    />,
  );
};

describe("ProductCard - layout da linha de quantidade/percentual", () => {
  it("renderiza o percentual sem posicionamento absoluto (nao sobrepoe o botao Consumir)", () => {
    renderCard();

    const percent = screen.getByText("50%");
    expect(percent).toBeInTheDocument();
    expect(percent.className).not.toMatch(/\babsolute\b/);
    expect(percent.className).not.toMatch(/left-1\/2|-translate-x-1\/2/);
  });

  it("mantem percentual e quantidade no mesmo grupo, separado do botao Consumir", () => {
    renderCard();

    const percent = screen.getByText("50%");
    const consume = screen.getByRole("button", { name: /Consumir Arroz Branco 5kg/ });

    expect(consume).toBeEnabled();
    expect(percent.parentElement?.contains(consume)).toBe(false);
    expect(percent.parentElement?.textContent).toContain("2 Un");
  });
});
