import { describe, expect, it } from "vitest";
import { extractProductParts } from "./brandDictionaryService";
import { describe, expect, it, vi } from "vitest";
import {
  extractProductParts,
  recordDiscoveredBrand,
  syncBrandDictionaryFromSupabase,
  getKnownBrandsCount,
} from "./brandDictionaryService";
import { supabase } from "../lib/supabase";

describe("brandDictionaryService", () => {
  describe("extractProductParts", () => {
    it("deve extrair produto base, marca e tamanho de um item completo", () => {
      const parts = extractProductParts("Feijão Preto Camil Tipo 1 1kg");
      expect(parts.baseProduct).toBe("Feijão Preto");
      expect(parts.brand).toBe("Camil");
      expect(parts.size).toEqual({ value: 1, unit: "kg" });
    });

    it("deve lidar com itens sem marca", () => {
      const parts = extractProductParts("Arroz Branco 5kg");
      expect(parts.baseProduct).toBe("Arroz Branco");
      expect(parts.brand).toBeNull();
      expect(parts.size).toEqual({ value: 5, unit: "kg" });
    });

    it("deve lidar com marcas compostas e acentuadas", () => {
      const parts = extractProductParts("Café 3 Corações 500g");
      expect(parts.baseProduct).toBe("Café");
      expect(parts.brand).toBe("3 Corações");
      expect(parts.size).toEqual({ value: 500, unit: "g" });
    });

    it("deve limpar stop words periféricas", () => {
      const parts = extractProductParts("Óleo de Soja Soya 900ml");
      expect(parts.baseProduct).toBe("Óleo de Soja Soya");
      expect(parts.brand).toBeNull(); // soya não está na lista por padrão
      expect(parts.size).toEqual({ value: 900, unit: "ml" });
    });
  });

  describe("syncBrandDictionaryFromSupabase & recordDiscoveredBrand", () => {
    it("deve registrar nova marca no cache e reconhecê-la posteriormente", async () => {
      const initialParts = extractProductParts("Biscoito Trakinas 120g");
      expect(initialParts.brand).toBeNull();

      // Registra a nova marca descoberta
      await recordDiscoveredBrand("Trakinas");

      const updatedParts = extractProductParts("Biscoito Trakinas 120g");
      expect(updatedParts.brand).toBe("Trakinas");
      expect(updatedParts.baseProduct).toBe("Biscoito");
    });

    it("deve retornar a contagem correta de marcas conhecidas", () => {
      const count = getKnownBrandsCount();
      expect(count).toBeGreaterThan(50);
    });

    it("deve sincronizar marcas ativas do Supabase com sucesso", async () => {
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockResolvedValueOnce({
            data: [
              { nome: "Qualitá", nome_normalizado: "qualita" },
              { nome: "Taeq", nome_normalizado: "taeq" },
            ],
            error: null,
          }),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      await syncBrandDictionaryFromSupabase();

      const parts = extractProductParts("Suco Taeq 1L");
      expect(parts.brand).toBe("Taeq");
    });

    it("não deve quebrar se o Supabase falhar na sincronização", async () => {
      vi.spyOn(supabase, "from").mockReturnValueOnce({
        select: vi.fn().mockReturnValueOnce({
          eq: vi.fn().mockRejectedValueOnce(new Error("Network Error")),
        }),
      } as unknown as ReturnType<typeof supabase.from>);

      await expect(syncBrandDictionaryFromSupabase()).resolves.toBeUndefined();
    });
  });
});
