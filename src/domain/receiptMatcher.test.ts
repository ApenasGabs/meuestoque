import { describe, it, expect } from "vitest";
import {
  normalizeText,
  tokenizeText,
  calculateTokenSimilarity,
  matchReceiptWithShoppingList,
} from "./receiptMatcher";
import type { NfceItem } from "./nfceParser";
import type { InventoryProduct, InventoryShoppingListItem } from "../features/inventory/types";

describe("receiptMatcher", () => {
  describe("normalizeText e tokenizeText", () => {
    it("deve remover acentos e caracteres especiais", () => {
      expect(normalizeText("Linguiça Toscana 100% Suína!")).toBe("linguica toscana 100 suina");
    });

    it("deve expandir abreviações conhecidas", () => {
      const tokens = tokenizeText("LING TOSC BOV UHT");
      expect(tokens).toContain("linguica");
      expect(tokens).toContain("toscana");
      expect(tokens).toContain("bovino");
      expect(tokens).toContain("leite");
    });

    it("deve filtrar palavras ruído", () => {
      const tokens = tokenizeText("Leite Integral Tipo A Leve Mais Pague Menos");
      expect(tokens).not.toContain("tipo");
      expect(tokens).not.toContain("leve");
      expect(tokens).not.toContain("mais");
      expect(tokens).not.toContain("pague");
      expect(tokens).not.toContain("menos");
    });
  });

  describe("calculateTokenSimilarity", () => {
    it("deve dar score alto para itens equivalentes", () => {
      const tokensA = ["linguica", "toscana"];
      const tokensB = ["linguica", "toscana", "sadia"];
      const score = calculateTokenSimilarity(tokensA, tokensB);
      expect(score).toBeGreaterThanOrEqual(0.8);
    });

    it("deve dar score baixo para itens não relacionados", () => {
      const tokensA = ["arroz", "branco"];
      const tokensB = ["sabao", "po", "omo"];
      const score = calculateTokenSimilarity(tokensA, tokensB);
      expect(score).toBeLessThan(0.3);
    });
  });

  describe("matchReceiptWithShoppingList", () => {
    const mockProducts: InventoryProduct[] = [
      {
        id: "prod-1",
        name: "Linguiça Toscana",
        quantity: 0,
        minStock: 1,
        categoryId: "carnes",
      },
      {
        id: "prod-2",
        name: "Leite Integral",
        quantity: 2,
        minStock: 4,
        categoryId: "laticinios",
      },
      {
        id: "prod-3",
        name: "Detergente Neutro",
        quantity: 1,
        minStock: 2,
        categoryId: "limpeza",
      },
    ];

    const mockListItems: InventoryShoppingListItem[] = [
      {
        id: "item-1",
        productId: "prod-1",
        quantity: 1,
        checked: false,
        validityDate: "2026-11-15", // Validade já pré-configurada na lista
        naoAplicaValidade: false,
      },
      {
        id: "item-2",
        productId: "prod-2",
        quantity: 2,
        checked: false,
        validityDate: null,
        naoAplicaValidade: false,
      },
      {
        id: "item-3",
        productId: "prod-3",
        quantity: 1,
        checked: false,
        validityDate: null,
        naoAplicaValidade: true, // Não se aplica
      },
    ];

    const mockNotaItens: NfceItem[] = [
      {
        id: "nfce-1",
        codigo: "72304",
        descricao: "LING TOSCANA LEVE MAIS KG",
        quantidade: 2.5,
        unidade: "KG",
        valorUnitario: 21.9,
        valorTotal: 54.75,
      },
      {
        id: "nfce-2",
        codigo: "505",
        descricao: "LEITE UHT INT PIRACANJUBA 1L",
        quantidade: 4,
        unidade: "UN",
        valorUnitario: 4.89,
        valorTotal: 19.56,
      },
      {
        id: "nfce-3",
        codigo: "999",
        descricao: "CHOCOLATE BARRA NESTLE 90G",
        quantidade: 1,
        unidade: "UN",
        valorUnitario: 6.5,
        valorTotal: 6.5,
      },
    ];

    it("deve casar os itens correspondentes e preservar as datas de validade da lista", () => {
      const result = matchReceiptWithShoppingList(mockNotaItens, mockListItems, mockProducts);

      expect(result.matches).toHaveLength(2);

      const lingMatch = result.matches.find((m) => m.product.name === "Linguiça Toscana");
      expect(lingMatch).toBeDefined();
      expect(lingMatch?.notaItem.descricao).toBe("LING TOSCANA LEVE MAIS KG");
      expect(lingMatch?.proposedQuantity).toBe(2.5);
      expect(lingMatch?.proposedUnit).toBe("Kg");
      expect(lingMatch?.proposedPrice).toBe(54.75);
      // Validando a regra primordial: preservou a data de validade da lista!
      expect(lingMatch?.preserveValidityDate).toBe("2026-11-15");
      expect(lingMatch?.preserveNaoAplica).toBe(false);

      const leiteMatch = result.matches.find((m) => m.product.name === "Leite Integral");
      expect(leiteMatch).toBeDefined();
      expect(leiteMatch?.notaItem.descricao).toBe("LEITE UHT INT PIRACANJUBA 1L");
      expect(leiteMatch?.proposedQuantity).toBe(4);
      expect(leiteMatch?.proposedPrice).toBe(19.56);
    });

    it("deve colocar itens da nota não encontrados na lista em unmatchedNota com selected=true", () => {
      const result = matchReceiptWithShoppingList(mockNotaItens, mockListItems, mockProducts);

      expect(result.unmatchedNota).toHaveLength(1);
      expect(result.unmatchedNota[0].notaItem.descricao).toBe("CHOCOLATE BARRA NESTLE 90G");
      expect(result.unmatchedNota[0].selected).toBe(true);
    });

    it("deve colocar itens da lista ausentes na nota em unmatchedList", () => {
      const result = matchReceiptWithShoppingList(mockNotaItens, mockListItems, mockProducts);

      expect(result.unmatchedList).toHaveLength(1);
      expect(result.unmatchedList[0].product.name).toBe("Detergente Neutro");
    });
  });
});
