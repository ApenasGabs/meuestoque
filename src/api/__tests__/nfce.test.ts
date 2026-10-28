import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import handleNfce from "../../../api/nfce";

describe("api/nfce Edge Function", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("deve responder OPTIONS com status 204 e headers CORS", async () => {
    const req = new Request("http://localhost/api/nfce", { method: "OPTIONS" });
    const res = await handleNfce(req);

    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("deve rejeitar métodos HTTP não permitidos com status 405", async () => {
    const req = new Request("http://localhost/api/nfce", { method: "DELETE" });
    const res = await handleNfce(req);

    expect(res.status).toBe(405);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Método não permitido");
  });

  it("deve rejeitar requisição sem parâmetro url ou chave com status 400", async () => {
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await handleNfce(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("obrigatório");
  });

  it("deve rejeitar entrada com URL malformada com status 400 (não 500)", async () => {
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "não-é-uma-url" }),
    });
    const res = await handleNfce(req);

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("formato inválido");
  });

  it("deve bloquear domínios não autorizados contra SSRF com status 403", async () => {
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://evil-server.com/?p=35261000000000000000652080000474581006519038",
      }),
    });
    const res = await handleNfce(req);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Domínio não autorizado");
  });

  it("deve rejeitar URL sem chave de acesso de 44 dígitos com status 422", async () => {
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=invalido",
      }),
    });
    const res = await handleNfce(req);

    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("44 dígitos");
  });

  it("deve retornar 504 Gateway Timeout quando upstream estoura o tempo limite", async () => {
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const error = new Error("The operation was aborted");
      error.name = "AbortError";
      return Promise.reject(error);
    });

    const chave = "35261000000000000000652080000474581006519038";
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave }),
    });

    const res = await handleNfce(req);

    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Tempo limite excedido");
  });

  it("deve bloquear redirecionamentos upstream para domínios não autorizados com 403", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "http://169.254.169.254/latest/meta-data" },
      }),
    );

    const chave = "35261000000000000000652080000474581006519038";
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave }),
    });

    const res = await handleNfce(req);

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("Redirecionamento para domínio não autorizado");
  });

  it("deve processar com sucesso a resposta válida da SEFAZ com status 200", async () => {
    const validHtml = `
      <html>
        <body>
          <div class="txtTopo">SUPERMERCADO TESTE</div>
          <table id="tabResult">
            <tr id="Item + 1">
              <td>
                <span class="txtTit">CAFE EM PO 500G</span>
                <span class="RCod">123</span>
                <span class="Rqtd">Qtde.: 1</span>
                <span class="RUN">UN: UN</span>
                <span class="RvlUnit">Vl. Unit.: 18,90</span>
              </td>
              <td><span class="valor">18,90</span></td>
            </tr>
          </table>
          <span class="totalNumb">18,90</span>
        </body>
      </html>
    `;

    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      new Response(validHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    const chave = "35261000000000000000652080000474581006519038";
    const req = new Request("http://localhost/api/nfce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave }),
    });

    const res = await handleNfce(req);

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { emitente: string; itens: unknown[] } };
    expect(body.success).toBe(true);
    expect(body.data.emitente).toBe("SUPERMERCADO TESTE");
    expect(body.data.itens).toHaveLength(1);
  });
});
