export interface NfceItem {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valorUnitario: number;
  valorTotal: number;
}

export interface NfceParsedDocument {
  chaveAcesso: string | null;
  emitente: string;
  cnpj: string | null;
  endereco: string | null;
  dataEmissao: string | null; // Formato ISO YYYY-MM-DD ou YYYY-MM-DDTHH:mm:ss
  total: number;
  itens: NfceItem[];
}

/**
 * Converte valor numérico em formato brasileiro ("1.234,56" ou "0,558") para number.
 */
export const parseBrazilianNumber = (raw: string | null | undefined): number => {
  if (!raw) return 0;
  const clean = raw
    .trim()
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const num = parseFloat(clean);
  return Number.isFinite(num) ? num : 0;
};

/**
 * Converte data de emissão em formato brasileiro ("25/10/2026 16:40:23" ou "25/10/2026") para ISO "YYYY-MM-DD".
 */
export const parseBrazilianDate = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const match = raw.match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!match) return null;

  const [, day, month, year, hours, minutes, seconds] = match;
  if (hours && minutes) {
    const sec = seconds ?? "00";
    return `${year}-${month}-${day}T${hours}:${minutes}:${sec}`;
  }
  return `${year}-${month}-${day}`;
};

/**
 * Normaliza e codifica a URL da SEFAZ para evitar bloqueios de firewall WAF (ex: pipes '|').
 */
export const normalizeNfceUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";

  // Se o usuário digitou apenas a chave de 44 dígitos
  if (/^\d{44}$/.test(trimmed)) {
    return `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${trimmed}%7C2%7C1%7C1%7C`;
  }

  // Se já for uma URL, codifica caracteres especiais no query string, principalmente '|'
  try {
    const parsed = new URL(trimmed);
    const pParam = parsed.searchParams.get("p");
    if (pParam && pParam.includes("|")) {
      // Reconstitui com %7C no lugar de |
      const encodedP = pParam.split("|").join("%7C");
      parsed.searchParams.set("p", encodedP);
      return parsed.toString().replace(/%257C/gi, "%7C");
    }
    return parsed.toString();
  } catch {
    // Caso não seja URL válida pelo construtor URL, substitui pipes diretamente
    return trimmed.replace(/\|/g, "%7C");
  }
};

/**
 * Extrai a chave de acesso de 44 dígitos a partir de uma URL ou string.
 */
export const extractChaveAcesso = (raw: string): string | null => {
  const match = raw.match(/\b(\d{44})\b/);
  return match ? match[1] : null;
};

/**
 * Extrai texto limpo removendo tags HTML e decodificando entidades básicas.
 */
const stripHtml = (html: string): string => {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * Parser resiliente do HTML da NFC-e de São Paulo (SEFAZ-SP / padrão nacional).
 * Funciona tanto no Vercel Edge Runtime quanto no Node.js e browser.
 */
export const parseNfceHtml = (html: string, fallbackUrl?: string): NfceParsedDocument => {
  // 1. Chave de acesso
  let chaveAcesso: string | null = null;
  const chaveMatch = html.match(/(?:Chave de Acesso|chaveAcesso)[^0-9]*([0-9\s]{44,60})/i);
  if (chaveMatch) {
    const digits = chaveMatch[1].replace(/\s+/g, "");
    if (digits.length === 44) {
      chaveAcesso = digits;
    }
  }
  if (!chaveAcesso && fallbackUrl) {
    chaveAcesso = extractChaveAcesso(fallbackUrl);
  }

  // 2. Emitente e CNPJ
  let emitente = "";
  const topoMatch = html.match(/class=["']txtTopo["'][^>]*>([^<]+)<\/div>/i);
  if (topoMatch) {
    emitente = stripHtml(topoMatch[1]);
  } else {
    const nomeFantasiaMatch = html.match(/id=["']lblNomeFantasia["'][^>]*>([^<]+)<\//i);
    if (nomeFantasiaMatch) emitente = stripHtml(nomeFantasiaMatch[1]);
  }

  let cnpj: string | null = null;
  const cnpjMatch = html.match(/CNPJ:\s*([\d./-]+)/i);
  if (cnpjMatch) {
    cnpj = cnpjMatch[1].trim();
  }

  // 3. Endereço
  let endereco: string | null = null;
  const enderecoMatch = html.match(/class=["']text["'][^>]*>([^<]+,\s*[^<]+,\s*[A-Z]{2})<\/div>/i);
  if (enderecoMatch) {
    endereco = stripHtml(enderecoMatch[1]);
  }

  // 4. Data de Emissão
  let dataEmissao: string | null = null;
  const emissaoMatch = html.match(/Emiss[aã]o:\s*<\/strong>\s*([^<]+)/i);
  if (emissaoMatch) {
    dataEmissao = parseBrazilianDate(emissaoMatch[1]);
  }

  // 5. Valor Total da Nota
  let total = 0;
  const totalPagarMatch = html.match(
    /Valor a pagar R\$:\s*<\/label>\s*<span class=["'][^"']*totalNumb[^"']*["']>([^<]+)<\/span>/i,
  );
  if (totalPagarMatch) {
    total = parseBrazilianNumber(totalPagarMatch[1]);
  } else {
    const totalFallbackMatch = html.match(/<span class=["']valor["']>([^<]+)<\/span>/i);
    if (totalFallbackMatch) {
      total = parseBrazilianNumber(totalFallbackMatch[1]);
    }
  }

  // 6. Itens da Nota Fiscal
  const itens: NfceItem[] = [];

  // Padrão SEFAZ: <tr id="Item + 1"> ... </tr>
  const rowRegex = /<tr\s+id=["']Item\s*\+\s*(\d+)["'][^>]*>([\s\S]*?)<\/tr>/gi;
  let match: RegExpExecArray | null;

  while ((match = rowRegex.exec(html)) !== null) {
    const itemIndex = match[1];
    const rowHtml = match[2];

    // Descrição
    const descMatch = rowHtml.match(/class=["']txtTit["'][^>]*>([\s\S]*?)<\/span>/i);
    const descricao = descMatch ? stripHtml(descMatch[1]) : `Item ${itemIndex}`;

    // Código do produto (ex: "(Código: 101 )")
    const codMatch = rowHtml.match(/class=["']RCod["'][^>]*>([\s\S]*?)<\/span>/i);
    let codigo = itemIndex;
    if (codMatch) {
      const codText = stripHtml(codMatch[1]);
      const numMatch = codText.match(/(\d+)/);
      if (numMatch) codigo = numMatch[1];
    }

    // Quantidade (ex: "<strong>Qtde.:</strong>2" ou "<strong>Qtde.:</strong>0,558")
    const qtdMatch = rowHtml.match(/class=["']Rqtd["'][^>]*>([\s\S]*?)<\/span>/i);
    let quantidade = 1;
    if (qtdMatch) {
      const qtdText = stripHtml(qtdMatch[1]);
      const numMatch = qtdText.match(/([0-9]+(?:[.,][0-9]+)?)/);
      if (numMatch) {
        quantidade = parseBrazilianNumber(numMatch[1]);
      }
    }

    // Unidade (ex: "<strong>UN: </strong>KG" ou "UN: UN")
    const unMatch = rowHtml.match(/class=["']RUN["'][^>]*>([\s\S]*?)<\/span>/i);
    let unidade = "UN";
    if (unMatch) {
      const unText = stripHtml(unMatch[1]);
      const cleanUn = unText.replace(/UN:\s*/i, "").trim().toUpperCase();
      if (cleanUn) unidade = cleanUn;
    }

    // Valor unitário (ex: "<strong>Vl. Unit.:</strong> 19,99")
    const vlUnitMatch = rowHtml.match(/class=["']RvlUnit["'][^>]*>([\s\S]*?)<\/span>/i);
    let valorUnitario = 0;
    if (vlUnitMatch) {
      const vlText = stripHtml(vlUnitMatch[1]);
      const numMatch = vlText.match(/([0-9]+(?:[.,][0-9]+)?)/);
      if (numMatch) {
        valorUnitario = parseBrazilianNumber(numMatch[1]);
      }
    }

    // Valor total do item (ex: "<span class="valor">11,15</span>")
    const vlTotMatch = rowHtml.match(/class=["']valor["'][^>]*>([\s\S]*?)<\/span>/i);
    let valorTotal = 0;
    if (vlTotMatch) {
      const vlText = stripHtml(vlTotMatch[1]);
      valorTotal = parseBrazilianNumber(vlText);
    }
    if (valorTotal === 0 && valorUnitario > 0) {
      valorTotal = valorUnitario * quantidade;
    }

    itens.push({
      id: `nfce-item-${itemIndex}`,
      codigo,
      descricao,
      quantidade,
      unidade,
      valorUnitario,
      valorTotal,
    });
  }

  // Fallback caso a tabela não use id="Item + X", mas classe .tabelaDetalhe ou linhas tr
  if (itens.length === 0) {
    const genericRowRegex = /<tr[^>]*class=["'][^"']*detalhe[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi;
    let genMatch: RegExpExecArray | null;
    let idx = 1;
    while ((genMatch = genericRowRegex.exec(html)) !== null) {
      const rowHtml = genMatch[1];
      const descMatch = rowHtml.match(/class=["']txtTit["'][^>]*>([^<]+)<\/span>/i);
      if (descMatch) {
        const descricao = stripHtml(descMatch[1]);
        const qtdMatch = rowHtml.match(/class=["']Rqtd["'][^>]*>[^0-9,.]*([0-9,.]+)/i);
        const unMatch = rowHtml.match(/class=["']RUN["'][^>]*>[^A-Za-z0-9]*([A-Za-z0-9]+)/i);
        const vlUnitMatch = rowHtml.match(/class=["']RvlUnit["'][^>]*>[^0-9,.]*([0-9,.]+)/i);
        const vlTotMatch = rowHtml.match(/class=["']valor["'][^>]*>([^<]+)<\/span>/i);

        const quantidade = qtdMatch ? parseBrazilianNumber(qtdMatch[1]) : 1;
        const valorUnitario = vlUnitMatch ? parseBrazilianNumber(vlUnitMatch[1]) : 0;
        const valorTotal = vlTotMatch ? parseBrazilianNumber(vlTotMatch[1]) : valorUnitario * quantidade;

        itens.push({
          id: `nfce-item-${idx}`,
          codigo: String(idx),
          descricao,
          quantidade,
          unidade: unMatch ? unMatch[1].trim().toUpperCase() : "UN",
          valorUnitario,
          valorTotal,
        });
        idx++;
      }
    }
  }

  return {
    chaveAcesso,
    emitente: emitente || "Mercado / Estabelecimento",
    cnpj,
    endereco,
    dataEmissao,
    total: total || itens.reduce((sum, item) => sum + item.valorTotal, 0),
    itens,
  };
};
