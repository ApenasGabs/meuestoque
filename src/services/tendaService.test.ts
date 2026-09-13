import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractProductSize,
  matchesProductSize,
  sanitizeItemSearchQuery,
  quoteShoppingItemOnTenda,
  resolveTendaBranchByCep,
} from "./tendaService";

describe("tendaService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extractProductSize", () => {
    it("deve extrair tamanho e unidade em kg", () => {
      const size = extractProductSize("Arroz Namorado 5kg");
      expect(size).toEqual({ value: 5, unit: "kg" });
    });

    it("deve extrair tamanho com espaço e vírgula", () => {
      const size = extractProductSize("Sabão em pó 1,6 kg");
      expect(size).toEqual({ value: 1.6, unit: "kg" });
    });

    it("deve extrair volume em ml e L", () => {
      expect(extractProductSize("Detergente Neutro 500ml")).toEqual({ value: 500, unit: "ml" });
      expect(extractProductSize("Leite Integral 1L")).toEqual({ value: 1, unit: "l" });
    });

    it("deve retornar null para itens sem peso explícito", () => {
      expect(extractProductSize("Maçã Gala")).toBeNull();
      expect(extractProductSize("Detergente")).toBeNull();
    });
  });

  describe("matchesProductSize", () => {
    const targetSize5kg = { value: 5, unit: "kg" as const };

    it("deve retornar true quando o tamanho do produto bater com o alvo", () => {
      expect(matchesProductSize("Arroz Branco Namorado 5kg", targetSize5kg)).toBe(true);
      expect(matchesProductSize("Arroz Camil Tipo 1 5,0 kg", targetSize5kg)).toBe(true);
    });

    it("deve retornar false quando o tamanho for diferente", () => {
      expect(matchesProductSize("Arroz Branco Namorado 1kg", targetSize5kg)).toBe(false);
      expect(matchesProductSize("Arroz Namorado 2kg", targetSize5kg)).toBe(false);
    });

    it("deve aceitar qualquer tamanho quando targetSize for null", () => {
      expect(matchesProductSize("Qualquer produto 1kg", null)).toBe(true);
    });
  });

  describe("sanitizeItemSearchQuery", () => {
    it("deve normalizar acentos e remover caracteres especiais", () => {
      expect(sanitizeItemSearchQuery("Feijão Carioca #1")).toBe("Feijao Carioca 1");
      expect(sanitizeItemSearchQuery("Café Pilão - 500g")).toBe("Cafe Pilao - 500g");
    });
  });

  describe("quoteShoppingItemOnTenda", () => {
    it("deve filtrar pelo peso solicitado e escolher o mais barato entre eles", async () => {
      const mockProducts = [
        {
          id: 1,
          name: "Arroz Tipo 1 Marca Cara 5kg",
          price: 26.5,
          brand: "Cara",
          wholesalePrices: null,
          url: "http://tenda/1",
        },
        {
          id: 2,
          name: "Arroz Tipo 1 Pacote Pequeno 1kg",
          price: 4.49,
          brand: "Pequeno",
          wholesalePrices: null,
          url: "http://tenda/2",
        },
        {
          id: 3,
          name: "Arroz Tipo 1 Econômico 5kg",
          price: 19.45,
          brand: "Econômico",
          wholesalePrices: null,
          url: "http://tenda/3",
        },
        {
          id: 4,
          name: "Arroz Tipo 1 Intermediário 5kg",
          price: 21.0,
          brand: "Inter",
          wholesalePrices: null,
          url: "http://tenda/4",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Arroz 5kg", 40);

      expect(quote.targetSize).toEqual({ value: 5, unit: "kg" });
      // O item de 1kg (R$ 4,49) não deve ser o recomendado porque o usuário pediu 5kg!
      expect(quote.recommended?.name).toBe("Arroz Tipo 1 Econômico 5kg");
      expect(quote.startingFromPrice).toBe(19.45);
      expect(quote.options).toHaveLength(3); // Apenas os 3 produtos de 5kg
    });

    it("deve retornar valores nulos quando nenhum produto for encontrado", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: [] }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Item Inexistente", 40);

      expect(quote.startingFromPrice).toBeNull();
      expect(quote.recommended).toBeNull();
      expect(quote.options).toEqual([]);
      expect(quote.totalFound).toBe(0);
    });
  });

  describe("resolveTendaBranchByCep", () => {
    it("deve resolver as informações da filial com sucesso", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          addressInfo: {
            city: "Campinas",
            district: "Vila Boa Vista",
            state: "SP",
            addressLine1: "Rua das Aroeiras",
          },
          delivery: {
            available: true,
            price: 14.9,
            expectedDeliveryDays: 2,
            branch: {
              id: 40,
              name: "Ceasa - Campinas",
            },
          },
        }),
      } as Response);

      const branch = await resolveTendaBranchByCep("13064-789");

      expect(branch.branchId).toBe(40);
      expect(branch.branchName).toBe("Ceasa - Campinas");
      expect(branch.deliveryPrice).toBe(14.9);
      expect(branch.available).toBe(true);
    });

    it("deve lançar erro se o CEP não tiver 8 dígitos", async () => {
      await expect(resolveTendaBranchByCep("123")).rejects.toThrow("CEP inválido");
    });
  });
});
