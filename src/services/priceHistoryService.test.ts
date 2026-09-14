import { describe, expect, it, vi } from "vitest";
import {
  calculatePriceTrend,
  getPriceHistoryForBaseProduct,
  recordStorePriceHistory,
  type StorePriceRecord,
} from "./priceHistoryService";
import type { TendaBranchInfo, TendaItemQuote } from "./tendaService";
import { supabase } from "../lib/supabase";

describe("priceHistoryService", () => {
  describe("calculatePriceTrend", () => {
    it("deve retornar none quando nao ha historico previo", () => {
      const result = calculatePriceTrend(10, []);
      expect(result.direction).toBe("none");
      expect(result.percentageChange).toBeNull();
      expect(result.previousPrice).toBeNull();
    });

    it("deve identificar reducao de preco (down)", () => {
      const history: StorePriceRecord[] = [
        {
          loja: "tenda",
          filial_id: 40,
          produto_base: "Feijao",
          marca: "Camil",
          produto_nome: "Feijao Camil 1kg",
          preco: 10.0,
          data_cotacao: "2026-09-01",
        },
      ];

      const result = calculatePriceTrend(8.0, history, "Camil");
      expect(result.direction).toBe("down");
      expect(result.previousPrice).toBe(10.0);
      expect(result.percentageChange).toBe(-20.0);
      expect(result.previousDate).toBe("2026-09-01");
    });

    it("deve identificar aumento de preco (up)", () => {
      const history: StorePriceRecord[] = [
        {
          loja: "tenda",
          filial_id: 40,
          produto_base: "Leite",
          marca: "Shefa",
          produto_nome: "Leite Shefa 1L",
          preco: 5.0,
          data_cotacao: "2026-09-05",
        },
      ];

      const result = calculatePriceTrend(6.0, history);
      expect(result.direction).toBe("up");
      expect(result.previousPrice).toBe(5.0);
      expect(result.percentageChange).toBe(20.0);
    });

    it("deve identificar estabilidade (stable) para variacoes menores que 1%", () => {
      const history: StorePriceRecord[] = [
        {
          loja: "tenda",
          filial_id: 40,
          produto_base: "Cafe",
          marca: "Pilao",
          produto_nome: "Cafe Pilao 500g",
          preco: 20.0,
          data_cotacao: "2026-09-02",
        },
      ];

      const result = calculatePriceTrend(20.1, history);
      expect(result.direction).toBe("stable");
      expect(result.percentageChange).toBe(0.5);
    });

    it("deve desconsiderar cotacoes da data atual para o calculo de historico", () => {
      const today = new Date().toISOString().split("T")[0];
      const history: StorePriceRecord[] = [
        {
          loja: "tenda",
          filial_id: 40,
          produto_base: "Arroz",
          marca: "Namorado",
          produto_nome: "Arroz Namorado 5kg",
          preco: 22.0,
          data_cotacao: today,
        },
      ];

      const result = calculatePriceTrend(22.0, history);
      expect(result.direction).toBe("none");
    });
  });

  describe("recordStorePriceHistory", () => {
    it("deve processar quotes e chamar upsert no Supabase", async () => {
      const upsertMock = vi.fn().mockResolvedValueOnce({ error: null });
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        upsert: upsertMock,
      } as unknown as ReturnType<typeof supabase.from>);

      const mockBranch: TendaBranchInfo = {
        branchId: 40,
        branchName: "Ceasa - Campinas",
        deliveryPrice: 14.9,
        deliveryDays: 2,
        address: "Rua Teste",
        available: true,
      };

      const mockQuotes: TendaItemQuote[] = [
        {
          itemName: "Feijao Preto Camil 1kg",
          baseProduct: "Feijao Preto",
          requestedBrand: "Camil",
          targetSize: { value: 1, unit: "kg" },
          startingFromPrice: 6.5,
          recommended: {
            id: 101,
            name: "Feijao Preto Camil 1kg",
            brand: "Camil",
            price: 6.5,
            wholesalePrices: [{ minQuantity: 5, price: 5.9 }],
            url: "https://tenda.com.br/item101",
            thumbnail: null,
            inStock: true,
          },
          sameBrandOffer: null,
          cheaperAlternativeOffer: {
            id: 102,
            name: "Feijao Preto Namorado 1kg",
            brand: "Namorado",
            price: 5.5,
            wholesalePrices: null,
            url: "https://tenda.com.br/item102",
            thumbnail: null,
            inStock: true,
          },
          options: [],
          totalFound: 2,
        },
      ];

      await recordStorePriceHistory(mockQuotes, mockBranch);
      expect(upsertMock).toHaveBeenCalledTimes(1);
    });
  });

  describe("getPriceHistoryForBaseProduct", () => {
    it("deve retornar lista de historico para produto base valido", async () => {
      const orderMock = vi.fn().mockResolvedValueOnce({
        data: [
          {
            id: "1",
            loja: "tenda",
            filial_id: 40,
            produto_base: "Arroz",
            marca: "Camil",
            produto_nome: "Arroz Camil 5kg",
            preco: 25.9,
            data_cotacao: "2026-09-10",
          },
        ],
        error: null,
      });
      const gteMock = vi.fn().mockReturnValue({ order: orderMock });
      const ilikeMock = vi.fn().mockReturnValue({ gte: gteMock });
      const selectMock = vi.fn().mockReturnValue({ ilike: ilikeMock });

      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: selectMock,
      } as unknown as ReturnType<typeof supabase.from>);

      const history = await getPriceHistoryForBaseProduct("Arroz", 30);
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBe(1);
      expect(history[0].produto_base).toBe("Arroz");
    });

    it("deve retornar array vazio se baseProduct for vazio", async () => {
      const history = await getPriceHistoryForBaseProduct("");
      expect(history).toEqual([]);
    });
  });
});

