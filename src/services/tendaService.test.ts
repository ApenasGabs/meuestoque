import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  extractProductSize,
  matchesProductSize,
  sanitizeItemSearchQuery,
  quoteShoppingItemOnTenda,
  resolveTendaBranchByCep,
  getTodayMidnightTimestamp,
  getCachedTendaData,
  setCachedTendaData,
  clearTendaCache,
} from "./tendaService";

describe("tendaService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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

    it("deve usar o cache na segunda chamada e permitir bypassCache", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          addressInfo: {
            city: "Campinas",
            district: "Vila Boa Vista",
            state: "SP",
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

      // Primeira chamada: busca via fetch
      const first = await resolveTendaBranchByCep("13064-789");
      expect(first.branchId).toBe(40);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Segunda chamada: vem do cache (fetchSpy não deve ser chamado novamente)
      const cached = await resolveTendaBranchByCep("13064-789");
      expect(cached.branchId).toBe(40);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Terceira chamada com bypassCache = true: deve forçar nova chamada de rede
      const fresh = await resolveTendaBranchByCep("13064-789", undefined, true);
      expect(fresh.branchId).toBe(40);
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it("deve lançar erro se o CEP não tiver 8 dígitos", async () => {
      await expect(resolveTendaBranchByCep("123")).rejects.toThrow("CEP inválido");
    });
  });

  describe("Cache com Expiração à Meia-Noite", () => {
    it("deve calcular o timestamp para as 23:59:59.999 do dia atual", () => {
      const midnight = getTodayMidnightTimestamp();
      const date = new Date(midnight);
      expect(date.getHours()).toBe(23);
      expect(date.getMinutes()).toBe(59);
      expect(date.getSeconds()).toBe(59);
      expect(date.getMilliseconds()).toBe(999);
      expect(midnight).toBeGreaterThan(Date.now());
    });

    it("deve salvar e recuperar dados do cache válidos", () => {
      setCachedTendaData("teste_key", { preco: 10.5 });
      const recuperado = getCachedTendaData<{ preco: number }>("teste_key");
      expect(recuperado).toEqual({ preco: 10.5 });
    });

    it("deve expirar e descartar dados quando ultrapassar a meia-noite", () => {
      // Simula dado salvo com timestamp expirado
      const ontem = Date.now() - 1000;
      localStorage.setItem("tenda_cache_expirado", JSON.stringify({ data: "antigo", expiresAt: ontem }));

      const resultado = getCachedTendaData<string>("expirado");
      expect(resultado).toBeNull();
      // Deve ter sido removido do localStorage
      expect(localStorage.getItem("tenda_cache_expirado")).toBeNull();
    });

    it("deve limpar todos os itens em cache via clearTendaCache", () => {
      setCachedTendaData("item1", "valor1");
      setCachedTendaData("item2", "valor2");
      localStorage.setItem("outro_app_item", "preservar");

      clearTendaCache();

      expect(getCachedTendaData("item1")).toBeNull();
      expect(getCachedTendaData("item2")).toBeNull();
      expect(localStorage.getItem("outro_app_item")).toBe("preservar");
    });
  });
});
