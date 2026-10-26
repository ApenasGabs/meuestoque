/**
 * Extrai a origem absoluta (protocolo + host) da requisição,
 * respeitando os cabeçalhos de proxy reverso da Vercel com fallback consistente.
 *
 * @param req - Objeto Request da requisição
 * @returns Origem formatada (ex: "https://meuestoque.apenasgabs.dev")
 */
export const getRequestOrigin = (req: Request): string => {
  const url = new URL(req.url);
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    url.host;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (!host) {
    return "https://meuestoque.apenasgabs.dev";
  }
  return `${proto}://${host}`;
};
