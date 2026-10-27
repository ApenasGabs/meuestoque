export const config = {
  runtime: "edge",
};

import { parseNfceHtml, normalizeNfceUrl } from "../src/domain/nfceParser";

const ALLOWED_HOSTS = [
  "www.nfce.fazenda.sp.gov.br",
  "nfce.fazenda.sp.gov.br",
  "satsp.fazenda.sp.gov.br",
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

  if (!rawUrl || typeof rawUrl !== "string") {
    return new Response(
      JSON.stringify({ error: "Parâmetro 'url' ou 'chave' da nota fiscal é obrigatório." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const targetUrl = normalizeNfceUrl(rawUrl);

  try {
    const parsedTarget = new URL(targetUrl);
    const hostAllowed = ALLOWED_HOSTS.some(
      (host) => parsedTarget.hostname === host || parsedTarget.hostname.endsWith(".fazenda.sp.gov.br"),
    );

    if (!hostAllowed) {
      return new Response(
        JSON.stringify({
          error: "Domínio não autorizado. Apenas consultas da SEFAZ-SP são permitidas.",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const upstreamRes = await fetch(targetUrl, {
      method: "GET",
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
    const message = err instanceof Error ? err.message : "Erro desconhecido ao consultar NFC-e";
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
};
