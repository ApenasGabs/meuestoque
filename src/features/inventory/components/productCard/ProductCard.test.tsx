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

  it("exibe metadados de consumo automatico e ruptura com legibilidade WCAG AA (sem opacity-40 nem text-[9px])", () => {
    render(
      <ProductCard
        product={{
          ...product,
          quantity: 2,
          packSize: 1,
          packLabel: "pct",
          consumeValue: 1,
          consumeFrequency: "daily",
          portionSize: 1,
        }}
        onEdit={vi.fn()}
        onAddToList={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const autoConsume = screen.getByText("⏰ -1/dia");
    const autoConsumeRow = autoConsume.parentElement as HTMLElement;
    expect(autoConsumeRow.className).toContain("text-xs");
    expect(autoConsumeRow.className).toContain("text-base-content/75");
    expect(autoConsumeRow.className).not.toContain("opacity-40");
    expect(autoConsumeRow.className).not.toContain("text-[9px]");

    const runout = screen.getByText(/dura ~2d/);
    expect(runout.className).toContain("text-error");
    expect(runout.className).toContain("font-bold");

    const totalPackSpan = screen.getByText("(2 Un)");
    expect(totalPackSpan.className).toContain("text-base-content/75");
    expect(totalPackSpan.className).not.toContain("opacity-60");
  });
});
