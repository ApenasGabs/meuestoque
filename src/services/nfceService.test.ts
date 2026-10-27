import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNfceData } from "./nfceService";

describe("nfceService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("deve lançar erro se a URL ou chave for vazia", async () => {
    await expect(fetchNfceData("")).rejects.toThrow("não informada");
  });

  it("deve retornar os dados da nota quando a API responder com sucesso", async () => {
    const mockData = {
      chaveAcesso: "35261000000000000000652080000474581006519038",
      emitente: "Supermercado Teste",
      cnpj: "00.000.000/0001-00",
      endereco: "Rua Teste, 1",
      dataEmissao: "2026-10-26T14:00:00",
      total: 50.0,
      itens: [],
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        success: true,
        data: mockData,
      }),
    } as unknown as Response);

    const result = await fetchNfceData("https://sefaz.sp.gov.br/?p=123");
    expect(result.emitente).toBe("Supermercado Teste");
    expect(result.total).toBe(50.0);
  });

  it("deve lançar erro com a mensagem retornada pela API em caso de erro 422/502", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({
        error: "Nota rejeitada pela SEFAZ",
      }),
    } as unknown as Response);

    await expect(fetchNfceData("https://sefaz.sp.gov.br/?p=invalido")).rejects.toThrow(
      "Nota rejeitada pela SEFAZ",
    );
  });

  it("deve lançar erro amigável de timeout quando ocorrer AbortError", async () => {
    const abortErr = new Error("Aborted");
    abortErr.name = "AbortError";

    globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

    await expect(fetchNfceData("https://sefaz.sp.gov.br/?p=123")).rejects.toThrow(
      "Tempo limite excedido ao consultar a nota fiscal",
    );
  });
});
