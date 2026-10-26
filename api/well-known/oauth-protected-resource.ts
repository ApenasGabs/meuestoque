export const config = {
  runtime: "edge",
};

export default function handler(req: Request): Response {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const url = new URL(req.url);
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const origin = `${proto}://${host}`;

  const metadata = {
    resource: `${origin}/api/mcp`,
    authorization_servers: [origin],
    scopes_supported: ["read", "write"],
    bearer_methods_supported: ["header"],
    resource_documentation: origin,
  };

  return new Response(JSON.stringify(metadata, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
