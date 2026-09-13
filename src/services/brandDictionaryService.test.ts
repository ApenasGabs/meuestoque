import { describe, expect, it } from "vitest";
import { extractProductParts } from "./brandDictionaryService";

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
});
