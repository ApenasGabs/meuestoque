export const config = {
  runtime: "edge",
};

import { parseNfceHtml, normalizeNfceUrl, extractChaveAcesso } from "../src/domain/nfceParser";

const ALLOWED_HOSTS = new Set([
  "www.nfce.fazenda.sp.gov.br",
  "nfce.fazenda.sp.gov.br",
  "satsp.fazenda.sp.gov.br",
]);

const UPSTREAM_TIMEOUT_MS = 8000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/**
 * Proxy serverless da Vercel (Edge) para consulta pública de NFC-e na SEFAZ-SP.
 * Valida a URL de entrada contra uma allowlist estrita de hosts, aplica timeout
 * e retorna os dados estruturados da nota fiscal.
 *
 * @param req - Requisição HTTP recebida pela Edge Function
 * @returns Resposta JSON contendo os dados extraídos da NFC-e ou mensagem de erro
 */
export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  let rawUrl = "";

  if (req.method === "GET") {
    const requestUrl = new URL(req.url);
    rawUrl = requestUrl.searchParams.get("url") ?? "";
  } else if (req.method === "POST") {
    try {
      const body = (await req.json()) as { url?: string; chave?: string };
      rawUrl = body.url || body.chave || "";
    } catch {
      return new Response(
        JSON.stringify({ error: "Corpo da requisição inválido (JSON esperado)" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  if (!rawUrl || typeof rawUrl !== "string" || !rawUrl.trim()) {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'url' ou 'chave' da nota fiscal é obrigatório." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const targetUrl = normalizeNfceUrl(rawUrl);

  let parsedTarget: URL;
  try {
    parsedTarget = new URL(targetUrl);
  } catch {
    return new Response(
      JSON.stringify({
        error: "URL ou chave de acesso da nota fiscal em formato inválido.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (parsedTarget.protocol !== "https:" || !ALLOWED_HOSTS.has(parsedTarget.hostname)) {
    return new Response(
      JSON.stringify({
        error: "Domínio não autorizado. Apenas consultas oficiais da SEFAZ-SP são permitidas.",
      }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!extractChaveAcesso(targetUrl)) {
    return new Response(
      JSON.stringify({
        error: "A URL ou chave informada não contém uma chave de acesso NFC-e válida de 44 dígitos.",
      }),
      {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return new Response(
        JSON.stringify({
          error: `SEFAZ respondeu com status ${upstreamRes.status}. Tente novamente mais tarde.`,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const html = await upstreamRes.text();

    if (html.includes("Request Rejected") || html.length < 500) {
      return new Response(
        JSON.stringify({
          error: "A consulta foi rejeitada pela SEFAZ ou a nota ainda não foi autorizada.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const parsedData = parseNfceHtml(html, targetUrl);

    if (parsedData.itens.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Nenhum item foi encontrado no comprovante retornado pela SEFAZ.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: parsedData,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return new Response(
        JSON.stringify({
          error: "Tempo limite excedido ao consultar a SEFAZ-SP. Tente novamente em instantes.",
        }),
        {
          status: 504,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        error: "Falha inesperada ao comunicar com a SEFAZ-SP.",
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } finally {
    clearTimeout(timeoutId);
  }
};
