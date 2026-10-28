import { describe, it, expect } from "vitest";
import {
  parseBrazilianNumber,
  parseBrazilianDate,
  formatIsoDateToPtBr,
  getLocalDateString,
  normalizeNfceUrl,
  extractChaveAcesso,
  parseNfceHtml,
} from "./nfceParser";

describe("nfceParser", () => {
  describe("parseBrazilianNumber", () => {
    it("deve converter número decimal simples com vírgula", () => {
      expect(parseBrazilianNumber("19,99")).toBe(19.99);
      expect(parseBrazilianNumber("0,558")).toBe(0.558);
    });

    it("deve converter número com milhar e vírgula", () => {
      expect(parseBrazilianNumber("1.234,56")).toBe(1234.56);
      expect(parseBrazilianNumber(" 10.500,00 ")).toBe(10500);
    });

    it("deve retornar 0 para valores vazios ou inválidos", () => {
      expect(parseBrazilianNumber("")).toBe(0);
      expect(parseBrazilianNumber(null)).toBe(0);
      expect(parseBrazilianNumber(undefined)).toBe(0);
      expect(parseBrazilianNumber("NaN")).toBe(0);
    });
  });

  describe("parseBrazilianDate", () => {
    it("deve converter data e hora brasileira para ISO", () => {
      expect(parseBrazilianDate("25/10/2026 16:40:23")).toBe("2026-10-25T16:40:23");
    });

    it("deve converter apenas data para YYYY-MM-DD", () => {
      expect(parseBrazilianDate("25/10/2026")).toBe("2026-10-25");
    });

    it("deve retornar null para formato inválido", () => {
      expect(parseBrazilianDate("")).toBeNull();
      expect(parseBrazilianDate("data invalida")).toBeNull();
      expect(parseBrazilianDate(null)).toBeNull();
    });
  });

  describe("formatIsoDateToPtBr", () => {
    it("deve formatar data YYYY-MM-DD para DD/MM/AAAA sem shift de fuso horário", () => {
      expect(formatIsoDateToPtBr("2026-11-15")).toBe("15/11/2026");
      expect(formatIsoDateToPtBr("2026-10-25T16:40:23")).toBe("25/10/2026");
      expect(formatIsoDateToPtBr(null)).toBe("");
    });
  });

  describe("getLocalDateString", () => {
    it("deve retornar data formatada no formato YYYY-MM-DD para uma data específica", () => {
      const fixedDate = new Date(2026, 9, 28, 23, 30, 0); // 28 de Outubro de 2026, 23:30 local
      expect(getLocalDateString(fixedDate)).toBe("2026-10-28");
    });

    it("deve retornar uma string no formato YYYY-MM-DD para a data padrão atual", () => {
      const result = getLocalDateString();
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("normalizeNfceUrl", () => {
    it("deve promover URLs HTTP para HTTPS para atender a política de segurança", () => {
      const httpUrl = "http://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35261000000000000000652080000474581006519038";
      const normalized = normalizeNfceUrl(httpUrl);
      expect(normalized.startsWith("https://")).toBe(true);
    });

    it("deve codificar pipes na URL da SEFAZ", () => {
      const raw =
        "https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=35261000000000000000652080000474581006519038|2|1|1|abc123hash";
      const normalized = normalizeNfceUrl(raw);
      expect(normalized).toContain("%7C2%7C1%7C1%7C");
      expect(normalized).not.toContain("|");
    });

    it("deve gerar URL a partir de chave de 44 dígitos pura", () => {
      const chave = "35261000000000000000652080000474581006519038";
      const normalized = normalizeNfceUrl(chave);
      expect(normalized).toContain(`p=${chave}%7C2%7C1%7C1%7C`);
    });
  });

  describe("extractChaveAcesso", () => {
    it("deve extrair chave de 44 dígitos contida em texto ou URL", () => {
      const url = "https://sefaz.sp.gov.br/?p=35261000000000000000652080000474581006519038|2|1";
      expect(extractChaveAcesso(url)).toBe("35261000000000000000652080000474581006519038");
    });
  });

  describe("parseNfceHtml com HTML sintético", () => {
    const syntheticHtml = `
      <!DOCTYPE html>
      <html>
        <body>
          <div class="txtTopo">SUPERMERCADO MODELO LTDA</div>
          <div class="text">CNPJ: 12.345.678/0001-90</div>
          <div class="text">Rua das Flores, 100, Centro, Campinas, SP</div>
          <div>
            <strong>Emissão: </strong>26/10/2026 14:30:00 - Via Consumidor
          </div>

          <table id="tabResult">
            <tr id="Item + 1">
              <td>
                <span class="txtTit">ARROZ BRANCO TIPO 1 5KG</span>
                <span class="RCod">(Código: 101)</span>
                <span class="Rqtd"><strong>Qtde.:</strong>2</span>
                <span class="RUN"><strong>UN: </strong>UN</span>
                <span class="RvlUnit"><strong>Vl. Unit.:</strong>25,90</span>
              </td>
              <td>
                <span class="valor">51,80</span>
              </td>
            </tr>
            <tr id="Item + 2">
              <td>
                <span class="txtTit">ALCATRA BOVINA KG</span>
                <span class="RCod">(Código: 202)</span>
                <span class="Rqtd"><strong>Qtde.:</strong>1,450</span>
                <span class="RUN"><strong>UN: </strong>KG</span>
                <span class="RvlUnit"><strong>Vl. Unit.:</strong>42,00</span>
              </td>
              <td>
                <span class="valor">60,90</span>
              </td>
            </tr>
          </table>

          <div id="linhaTotal" class="linhaShade">
            <label>Valor a pagar R$:</label>
            <span class="totalNumb txtMax">112,70</span>
          </div>
        </body>
      </html>
    `;

    it("deve extrair dados do cabeçalho corretamente", () => {
      const doc = parseNfceHtml(syntheticHtml);
      expect(doc.emitente).toBe("SUPERMERCADO MODELO LTDA");
      expect(doc.cnpj).toBe("12.345.678/0001-90");
      expect(doc.endereco).toBe("Rua das Flores, 100, Centro, Campinas, SP");
      expect(doc.dataEmissao).toBe("2026-10-26T14:30:00");
      expect(doc.total).toBe(112.7);
    });

    it("deve extrair itens da tabela com suas propriedades", () => {
      const doc = parseNfceHtml(syntheticHtml);
      expect(doc.itens).toHaveLength(2);

      const [item1, item2] = doc.itens;

      expect(item1.descricao).toBe("ARROZ BRANCO TIPO 1 5KG");
      expect(item1.codigo).toBe("101");
      expect(item1.quantidade).toBe(2);
      expect(item1.unidade).toBe("UN");
      expect(item1.valorUnitario).toBe(25.9);
      expect(item1.valorTotal).toBe(51.8);

      expect(item2.descricao).toBe("ALCATRA BOVINA KG");
      expect(item2.codigo).toBe("202");
      expect(item2.quantidade).toBe(1.45);
      expect(item2.unidade).toBe("KG");
      expect(item2.valorUnitario).toBe(42.0);
      expect(item2.valorTotal).toBe(60.9);
    });
  });
});
