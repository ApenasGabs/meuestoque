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
  isProductSemanticallyRelevant,
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
    it("deve normalizar acentos, minusculas, pesos e remover caracteres especiais", () => {
      expect(sanitizeItemSearchQuery("Feijão Carioca #1")).toBe("feijao carioca 1");
      expect(sanitizeItemSearchQuery("Café Pilão - 500g")).toBe("cafe pilao");
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

    it("deve rejeitar Arroz ao cotar Feijão Preto, mesmo se o arroz for mais barato", async () => {
      const mockProducts = [
        {
          id: 1,
          name: "Arroz Tipo 1 Select 1Kg",
          price: 3.99, // Mais barato que o feijão!
          brand: "Select",
          wholesalePrices: null,
          url: "http://tenda/arroz-select",
        },
        {
          id: 2,
          name: "Feijão Preto Tipo 1 Select 1kg",
          price: 5.59,
          brand: "Select",
          wholesalePrices: null,
          url: "http://tenda/feijao-select",
        },
        {
          id: 3,
          name: "Feijão Preto Camil 1kg",
          price: 6.79,
          brand: "Camil",
          wholesalePrices: null,
          url: "http://tenda/feijao-camil",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Feijão Preto Camil Tipo 1 1kg", 40);

      // Nunca deve escolher o Arroz de R$ 3,99!
      expect(quote.recommended?.name).not.toContain("Arroz");
      expect(quote.recommended?.name).toContain("Feijão Preto");
      expect(quote.startingFromPrice).toBe(5.59);
    });

    it("deve cotar marca solicitada (Camil) e identificar alternativa mais barata (Sabor Máximo)", async () => {
      const mockProducts = [
        {
          id: 101,
          name: "Feijão Preto Sabor Máximo 1kg",
          price: 5.39,
          brand: "Sabor Máximo",
          wholesalePrices: null,
          url: "https://tendaatacado.com.br/produto/feijao-preto-sabor-maximo-1kg",
          thumbnail: null,
          inStock: true,
        },
        {
          id: 102,
          name: "Feijão Preto Tipo 1 Select 1kg",
          price: 5.59,
          brand: "Select",
          wholesalePrices: null,
          url: "https://tendaatacado.com.br/produto/feijao-preto-select-1kg",
          thumbnail: null,
          inStock: true,
        },
        {
          id: 103,
          name: "Feijão Preto Camil 1kg",
          price: 6.79,
          brand: "Camil",
          wholesalePrices: null,
          url: "https://tendaatacado.com.br/produto/feijao-preto-camil-1kg",
          thumbnail: null,
          inStock: true,
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Feijão Preto Camil Tipo 1 1kg", 40);

      // Deve identificar a marca solicitada
      expect(quote.requestedBrand?.toLowerCase()).toBe("camil");
      expect(quote.baseProduct).toBe("Feijão Preto");

      // Deve recomendar a oferta da marca solicitada
      expect(quote.recommended?.id).toBe(103);
      expect(quote.recommended?.brand).toBe("Camil");
      expect(quote.recommended?.price).toBe(6.79);

      // Deve apontar Sabor Máximo como alternativa mais barata existente
      expect(quote.cheaperAlternativeOffer).not.toBeNull();
      expect(quote.cheaperAlternativeOffer?.id).toBe(101);
      expect(quote.cheaperAlternativeOffer?.brand).toBe("Sabor Máximo");
      expect(quote.cheaperAlternativeOffer?.price).toBe(5.39);
      expect(quote.cheaperAlternativeOffer?.url).toBe(
        "https://tendaatacado.com.br/produto/feijao-preto-sabor-maximo-1kg",
      );
    });

    it("não deve sugerir alternativa se a marca solicitada já for a mais barata", async () => {
      const mockProducts = [
        {
          id: 201,
          name: "Arroz Camil 5kg",
          price: 18.9,
          brand: "Camil",
          wholesalePrices: null,
          url: "https://tenda/camil-5kg",
          thumbnail: null,
          inStock: true,
        },
        {
          id: 202,
          name: "Arroz Tio João 5kg",
          price: 24.5,
          brand: "Tio João",
          wholesalePrices: null,
          url: "https://tenda/tiojoao-5kg",
          thumbnail: null,
          inStock: true,
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Arroz Camil 5kg", 40);

      expect(quote.recommended?.brand).toBe("Camil");
      expect(quote.recommended?.price).toBe(18.9);
      expect(quote.cheaperAlternativeOffer).toBeNull();
    });

    it("deve rejeitar Goiaba, Alho e produtos derivados ao cotar Limão Taiti", async () => {
      const mockProducts = [
        {
          id: 10,
          name: "Goiaba Vermelha 200g",
          price: 2.38, // 200g e super barata
          brand: "",
          wholesalePrices: null,
          url: "http://tenda/goiaba",
        },
        {
          id: 11,
          name: "Alho Select 200g",
          price: 9.39,
          brand: "Select",
          wholesalePrices: null,
          url: "http://tenda/alho",
        },
        {
          id: 12,
          name: "Detergente Líquido Limpol Limão 500ml",
          price: 1.99,
          brand: "Limpol",
          wholesalePrices: null,
          url: "http://tenda/detergente",
        },
        {
          id: 13,
          name: "Refresco em pó Tang Limão 18g",
          price: 0.95,
          brand: "Tang",
          wholesalePrices: null,
          url: "http://tenda/tang",
        },
        {
          id: 14,
          name: "Limão Tahiti Saco 500g",
          price: 5.95,
          brand: "",
          wholesalePrices: null,
          url: "http://tenda/limao-tahiti",
        },
      ];

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
      } as Response);

      const quote = await quoteShoppingItemOnTenda("Limão Taiti 200g", 40);

      // Nunca deve escolher Goiaba de 200g, Alho de 200g nem Detergente!
      expect(quote.recommended?.name).toBe("Limão Tahiti Saco 500g");
      expect(quote.startingFromPrice).toBe(5.95);
    });
  });

  describe("isProductSemanticallyRelevant", () => {
    it("deve rejeitar produtos de outra categoria ou grão", () => {
      expect(
        isProductSemanticallyRelevant("Arroz Tipo 1 Select 1Kg", "Feijão Preto Camil Tipo 1 1kg"),
      ).toBe(false);
      expect(isProductSemanticallyRelevant("Feijão Carioca 1kg", "Feijão Preto 1kg")).toBe(false);
      expect(isProductSemanticallyRelevant("Goiaba Vermelha 200g", "Limão Taiti 200g")).toBe(false);
      expect(isProductSemanticallyRelevant("Alho Select 200g", "Limão Taiti 200g")).toBe(false);
    });

    it("deve rejeitar produtos de limpeza ou bebidas aromatizadas quando solicitado alimento in natura", () => {
      expect(
        isProductSemanticallyRelevant("Detergente Líquido Limpol Limão 500ml", "Limão Taiti 200g"),
      ).toBe(false);
      expect(
        isProductSemanticallyRelevant("Refresco em pó Tang Limão 18g", "Limão Taiti 200g"),
      ).toBe(false);
      expect(
        isProductSemanticallyRelevant("Biscoito Wafer Limão Select 125g", "Limão Taiti 200g"),
      ).toBe(false);
    });

    it("deve aceitar produtos legítimos com variações de grafia", () => {
      expect(isProductSemanticallyRelevant("Limão Tahiti Saco 500g", "Limão Taiti 200g")).toBe(
        true,
      );
      expect(
        isProductSemanticallyRelevant("Feijão Preto Camil 1kg", "Feijão Preto Camil Tipo 1 1kg"),
      ).toBe(true);
      expect(
        isProductSemanticallyRelevant("Feijão Preto Tipo 1 Select 1kg", "Feijão Preto 1kg"),
      ).toBe(true);
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
      localStorage.setItem(
        "tenda_cache_expirado",
        JSON.stringify({ data: "antigo", expiresAt: ontem }),
      );

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

  describe("isProductSemanticallyRelevant e DERIVATIVE_WORDS", () => {
    const exclusionTestCases = [
      {
        requested: "Cenoura 200g",
        candidate: "Bolo Cenoura com Chocolate Bauducco 200g",
        word: "bolo",
      },
      {
        requested: "Cenoura 1kg",
        candidate: "Torta de Cenoura com Requeijao 400g",
        word: "torta",
      },
      {
        requested: "Batata 1kg",
        candidate: "Batata Palha Extra Fina Select 120g",
        word: "palha",
      },
      {
        requested: "Batata Inglesa 1kg",
        candidate: "Pure de Batata Instantaneo Maggi 100g",
        word: "pure",
      },
      {
        requested: "Milho Verde 1kg",
        candidate: "Flocos de Milho Sem Acucar Kellogg's 300g",
        word: "flocos",
      },
      {
        requested: "Chocolate em barra 100g",
        candidate: "Pudim de Chocolate Dr Oetker 50g",
        word: "pudim",
      },
      {
        requested: "Morango Fresco 250g",
        candidate: "Iogurte de Morango Integral Vigor 170g",
        word: "iogurte",
      },
      {
        requested: "Banana Prata 1kg",
        candidate: "Vitamina de Banana e Maca Piracanjuba 200ml",
        word: "vitamina",
      },
      {
        requested: "Palmito 300g",
        candidate: "Palmito Picado em Conserva Qualita 300g",
        word: "conserva",
      },
      {
        requested: "Limao Taiti 200g",
        candidate: "Detergente Liquido Limao Ype 500ml",
        word: "detergente",
      },
    ];

    it.each(exclusionTestCases)(
      "deve excluir derivado '$word' quando solicitado ingrediente puro ($requested vs $candidate)",
      ({ requested, candidate }) => {
        expect(isProductSemanticallyRelevant(candidate, requested)).toBe(false);
      },
    );

    const matchTestCases = [
      {
        requested: "Bolo de Cenoura Bauducco 200g",
        candidate: "Bolo Cenoura com Chocolate Bauducco 200g",
        description: "permite bolo quando o usuario solicita bolo",
      },
      {
        requested: "Batata Palha Tradicional",
        candidate: "Batata Palha Yoki 120g",
        description: "permite batata palha quando o usuario solicita batata palha",
      },
      {
        requested: "Iogurte de Morango Vigor",
        candidate: "Iogurte de Morango Integral Vigor 170g",
        description: "permite iogurte quando solicitado explicitamente",
      },
      {
        requested: "Pure de Batata Maggi",
        candidate: "Pure de Batata Instantaneo Maggi 100g",
        description: "permite pure quando solicitado explicitamente",
      },
      {
        requested: "Cenoura 1kg",
        candidate: "Cenoura Selecionada a Vacuo 500g",
        description: "permite cenoura in natura",
      },
      {
        requested: "Feijao Preto Camil 1kg",
        candidate: "Feijao Preto Namorado Tipo 1 1kg",
        description: "permite mesma categoria e subtipo de feijao",
      },
    ];

    it.each(matchTestCases)(
      "deve manter compatibilidade legitima: $description",
      ({ requested, candidate }) => {
        expect(isProductSemanticallyRelevant(candidate, requested)).toBe(true);
      },
    );
  });
});
