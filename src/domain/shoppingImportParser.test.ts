import { describe, expect, it } from "vitest";
import { parseShoppingImportText } from "./shoppingImportParser";

describe("shoppingImportParser", () => {
  it("parseia formato do Pague Menos com preco total", () => {
    const raw = `
Item\tQuantidade\tValor unitário\tValor total

Milho Verde Em Conserva Quero 170g

2\tR$ 3,49\tR$ 6,98

Abóbora Cambotiá Pedaço KG

1500\tR$ 0,00\tR$ 4,94
`;

    const items = parseShoppingImportText(raw, { source: "pague-menos" });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      nome: "Milho Verde Em Conserva Quero 170g",
      quantidade: "2 un",
      preco: 6.98,
    });
    expect(items[1]).toMatchObject({
      nome: "Abóbora Cambotiá Pedaço KG",
      quantidade: "1.5 kg",
      preco: 4.94,
    });
  });

  it("parseia formato do Tenda com total por item", () => {
    const raw = `
Mercearia
Amido de Milho Pq 1kg
Amido de Milho Pq 1kg
R$ 7,50
4 itens
Total: R$ 30,00
`;

    const items = parseShoppingImportText(raw, { source: "tenda" });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      nome: "Amido de Milho Pq 1kg",
      categoria: "Grãos",
      quantidade: "4 un",
      preco: 30,
    });
  });
});
