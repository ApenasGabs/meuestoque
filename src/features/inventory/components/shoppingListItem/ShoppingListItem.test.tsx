import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ShoppingListItem } from "./ShoppingListItem";
import type { InventoryProduct, InventoryShoppingListItem } from "../../types";

const mockItem: InventoryShoppingListItem = {
  id: "item-123",
  productId: "prod-123",
  quantity: 2,
  checked: false,
  price: 15.5,
};

const mockProduct: InventoryProduct = {
  id: "prod-123",
  name: "Arroz Branco 5kg",
  quantity: 2,
  minStock: 1,
  categoryId: "Outros",
  unit: "Un",
};

describe("ShoppingListItem - Edicao de Nome", () => {
  it("exibe o nome do produto e o botao de edicao", () => {
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("Arroz Branco 5kg")).toBeInTheDocument();
    expect(screen.getByTestId("edit-item-name-arroz-branco-5kg")).toBeInTheDocument();
  });

  it("abre o input de edicao ao clicar no botao de editar", () => {
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const editBtn = screen.getByTestId("edit-item-name-arroz-branco-5kg");
    fireEvent.click(editBtn);

    const input = screen.getByTestId("shopping-item-name-input") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.value).toBe("Arroz Branco 5kg");
    expect(screen.getByTestId("save-item-name-button")).toBeInTheDocument();
    expect(screen.getByTestId("cancel-item-name-button")).toBeInTheDocument();
  });

  it("abre o input de edicao ao clicar diretamente no nome do produto", () => {
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    const nameSpan = screen.getByTestId("shopping-item-name-arroz-branco-5kg");
    fireEvent.click(nameSpan);

    expect(screen.getByTestId("shopping-item-name-input")).toBeInTheDocument();
  });

  it("salva o novo nome ao clicar no botao de confirmar", () => {
    const handleUpdateName = vi.fn();
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onUpdateName={handleUpdateName}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-item-name-arroz-branco-5kg"));

    const input = screen.getByTestId("shopping-item-name-input");
    fireEvent.change(input, { target: { value: "Arroz Integral Camil 5kg" } });
    fireEvent.mouseDown(screen.getByTestId("save-item-name-button"));

    expect(handleUpdateName).toHaveBeenCalledWith("item-123", "Arroz Integral Camil 5kg");
    expect(screen.queryByTestId("shopping-item-name-input")).not.toBeInTheDocument();
  });

  it("salva o novo nome ao pressionar Enter", () => {
    const handleUpdateName = vi.fn();
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onUpdateName={handleUpdateName}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-item-name-arroz-branco-5kg"));

    const input = screen.getByTestId("shopping-item-name-input");
    fireEvent.change(input, { target: { value: "Arroz Parboilizado" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleUpdateName).toHaveBeenCalledWith("item-123", "Arroz Parboilizado");
    expect(screen.queryByTestId("shopping-item-name-input")).not.toBeInTheDocument();
  });

  it("cancela a edicao ao pressionar Escape sem chamar onUpdateName", () => {
    const handleUpdateName = vi.fn();
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onUpdateName={handleUpdateName}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-item-name-arroz-branco-5kg"));

    const input = screen.getByTestId("shopping-item-name-input");
    fireEvent.change(input, { target: { value: "Nome Cancelado" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(handleUpdateName).not.toHaveBeenCalled();
    expect(screen.queryByTestId("shopping-item-name-input")).not.toBeInTheDocument();
    expect(screen.getByText("Arroz Branco 5kg")).toBeInTheDocument();
  });

  it("cancela a edicao ao clicar no botao de cancelar", () => {
    const handleUpdateName = vi.fn();
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onUpdateName={handleUpdateName}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-item-name-arroz-branco-5kg"));

    const input = screen.getByTestId("shopping-item-name-input");
    fireEvent.change(input, { target: { value: "Outro Nome" } });
    fireEvent.mouseDown(screen.getByTestId("cancel-item-name-button"));

    expect(handleUpdateName).not.toHaveBeenCalled();
    expect(screen.queryByTestId("shopping-item-name-input")).not.toBeInTheDocument();
  });

  it("nao chama onUpdateName se o nome nao foi modificado", () => {
    const handleUpdateName = vi.fn();
    render(
      <ShoppingListItem
        item={mockItem}
        product={mockProduct}
        onToggle={vi.fn()}
        onRemove={vi.fn()}
        onUpdateName={handleUpdateName}
      />,
    );

    fireEvent.click(screen.getByTestId("edit-item-name-arroz-branco-5kg"));
    fireEvent.mouseDown(screen.getByTestId("save-item-name-button"));

    expect(handleUpdateName).not.toHaveBeenCalled();
  });
});
