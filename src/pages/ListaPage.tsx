import type { Dispatch, KeyboardEvent, ReactElement, SetStateAction } from "react";
import { useState } from "react";
import { Button } from "../components/Button/Button";
import { Checkbox } from "../components/Checkbox/Checkbox";
import { Input } from "../components/Input/Input";
import type { ShoppingItem } from "../types/inventory";
import { useNavigate } from "react-router-dom";

interface ListaPageProps {
  items: ShoppingItem[];
  setItems: Dispatch<SetStateAction<ShoppingItem[]>>;
  onFinalize: (checkedItems: ShoppingItem[]) => void;
}

export const ListaPage = ({ items, setItems, onFinalize }: ListaPageProps): ReactElement => {
  const [input, setInput] = useState<string>("");
  const checkedCount = items.filter((item) => item.checked).length;
  const navigate = useNavigate();

  const addItem = (): void => {
    const value = input.trim();
    if (!value) {
      return;
    }

    setItems((previous) => [...previous, { id: Date.now(), name: value, checked: false }]);
    setInput("");
  };

  const toggleItem = (id: number): void => {
    setItems((previous) =>
      previous.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  };

  const removeItem = (id: number): void => {
    setItems((previous) => previous.filter((item) => item.id !== id));
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "Enter") {
      addItem();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 bg-base-100 border-b border-base-300 sticky top-14 z-20">
        <div className="flex gap-2 items-end">
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Adicionar item a lista"
            className="w-full"
            data-testid="shopping-input"
          />
          <Button
            variant="primary"
            onClick={addItem}
            aria-label="Adicionar item"
            className="min-w-12"
            data-testid="add-item-btn"
          >
            Add +
          </Button>
        </div>

        {checkedCount > 0 && (
          <p className="text-xs text-base-content/60 mt-2 font-mono">
            {checkedCount} de {items.length} marcados
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pb-36">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-base-content/60 text-sm">
            Lista vazia. Adicione um item acima.
          </div>
        ) : (
          <ul className="divide-y divide-base-300">
            {items.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 bg-base-100 transition-opacity ${item.checked ? "opacity-50" : ""}`}
              >
                <Checkbox
                  checked={item.checked}
                  onChange={() => toggleItem(item.id)}
                  aria-label={`Marcar item ${item.name}`}
                />

                <span
                  className={`flex-1 text-sm ${item.checked ? "line-through text-base-content/50" : "text-base-content"}`}
                >
                  {item.name}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remover item ${item.name}`}
                  data-testid={`remove-${item.id}`}
                >
                  x
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        variant="primary"
        onClick={() => navigate("/history")}
        className="w-full"
        data-testid="history-btn"
      >
        Historico
      </Button>
      {checkedCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-3">
          <Button
            variant="primary"
            onClick={() => onFinalize(items.filter((item) => item.checked))}
            className="w-full"
            data-testid="finalize-btn"
          >
            Finalizar Compra ({checkedCount} {checkedCount === 1 ? "item" : "itens"})
          </Button>
        </div>
      )}
    </div>
  );
};
