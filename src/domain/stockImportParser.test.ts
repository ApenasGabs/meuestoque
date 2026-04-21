import { describe, expect, it } from "vitest";
import { parseStockImportText } from "./stockImportParser";

describe("stockImportParser", () => {
  it("parseia formato de lista com itens e totais", () => {
    const raw = `
Mercearia
Achocolatado em Pó Professional NESCAU 2,010kg
Achocolatado em Pó Professional NESCAU 2,010kg
R$ 34,90
1 item
Total: R$ 34,90
Amido de Milho Pq 1kg
Amido de Milho Pq 1kg
R$ 7,50
4 itens
Total: R$ 30,00
`;

    const items = parseStockImportText(raw);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      nome: "Achocolatado em Pó Professional NESCAU 2,010kg",
      categoria: "Graos e secos",
      unidade: "kg",
      quantidade: 2.01,
    });
    expect(items[1]).toMatchObject({
      nome: "Amido de Milho Pq 1kg",
      categoria: "Graos e secos",
      unidade: "kg",
      quantidade: 4,
    });
  });

  it("parseia formato tabular com quantidade e preco", () => {
    const raw = `
super mercado pague menos

Item\tQuantidade\tValor unitário\tValor total

Feijão Carioca Camil Tipo 1 1kg

6\tR$ 5,99\tR$ 35,94

Abóbora Cambotiá Pedaço KG

1500\tR$ 0,00\tR$ 4,94
`;

    const items = parseStockImportText(raw);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      nome: "Feijão Carioca Camil Tipo 1 1kg",
      unidade: "kg",
      quantidade: 6,
    });

    expect(items[1]).toMatchObject({
      nome: "Abóbora Cambotiá Pedaço KG",
      unidade: "kg",
      quantidade: 1.5,
    });
  });

  it("parseia formato pague menos com source explicita", () => {
    const raw = `
Item\tQuantidade\tValor unitário\tValor total

Leite Longa Vida Shefa Integral 1l

48\tR$ 2,99\tR$ 143,52
`;

    const items = parseStockImportText(raw, { source: "pague-menos" });

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      nome: "Leite Longa Vida Shefa Integral 1l",
      unidade: "L",
      quantidade: 48,
    });
  });

  it("consolida itens repetidos por nome e unidade", () => {
    const raw = `
Farinha de Trigo Select 1kg
Farinha de Trigo Select 1kg
R$ 2,50
2 itens
Total: R$ 5,00
Farinha de Trigo Select 1kg
Farinha de Trigo Select 1kg
R$ 2,50
3 itens
Total: R$ 7,50
`;

    const items = parseStockImportText(raw);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      nome: "Farinha de Trigo Select 1kg",
      unidade: "kg",
      quantidade: 5,
    });
  });

  it("parseia linha unica com nome, preco, quantidade e total", () => {
    const raw = "Costela Bovina Minga Congelada 6kg  R$ 143,40 1 item Total: R$ 143,40";

    const items = parseStockImportText(raw);

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      nome: "Costela Bovina Minga Congelada 6kg",
      unidade: "kg",
      quantidade: 6,
    });
  });
});
