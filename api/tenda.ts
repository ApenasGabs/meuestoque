export const config = {
  runtime: "edge",
};

/**
 * Proxy serverless da Vercel para a API do Tenda Atacado.
 * Evita problemas de CORS no navegador e inclui cache compartilhado de 5 minutos.
 *
 * @param req - Objeto de requisição do navegador
 * @returns Resposta com dados da API do Tenda e cabeçalhos CORS liberados
 */
export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  const url = new URL(req.url);
  const pathParam = url.searchParams.get("path");
  url.searchParams.delete("path");

  let targetPath = "";
  if (pathParam) {
    targetPath = pathParam.startsWith("/") ? pathParam : `/${pathParam}`;
  } else {
    targetPath = url.pathname.replace(/^\/api\/tenda/, "");
  }

  const queryString = url.searchParams.toString() ? `?${url.searchParams.toString()}` : "";
  const targetUrl = `https://api.tendaatacado.com.br/api${targetPath}${queryString}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Origin: "https://www.tendaatacado.com.br",
        Referer: "https://www.tendaatacado.com.br/",
      },
    });

    const responseBody = await upstreamRes.arrayBuffer();

    return new Response(responseBody, {
      status: upstreamRes.status,
      headers: {
        "Content-Type": upstreamRes.headers.get("Content-Type") ?? "application/json",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Proxy error";
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
};
