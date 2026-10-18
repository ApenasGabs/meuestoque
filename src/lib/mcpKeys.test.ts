import { describe, it, expect, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));

import { buildMcpConfig, getMcpKeyStatus, type McpApiKey } from "./mcpKeys";

const baseKey: McpApiKey = {
  id: "k1",
  name: "Claude",
  key_prefix: "mest_pat_abcdef",
  scopes: ["read", "write"],
  created_at: "2026-01-01T00:00:00Z",
  last_used_at: null,
  expires_at: "2026-12-31T00:00:00Z",
  revoked_at: null,
};

const NOW = new Date("2026-06-01T00:00:00Z").getTime();

describe("getMcpKeyStatus", () => {
  it("returns active for valid keys", () => {
    expect(getMcpKeyStatus(baseKey, NOW)).toBe("active");
  });

  it("returns revoked when revoked_at is set", () => {
    expect(getMcpKeyStatus({ ...baseKey, revoked_at: "2026-05-01T00:00:00Z" }, NOW)).toBe("revoked");
  });

  it("returns expired after expires_at", () => {
    expect(getMcpKeyStatus({ ...baseKey, expires_at: "2026-05-01T00:00:00Z" }, NOW)).toBe("expired");
  });

  it("returns expiring within 7 days", () => {
    expect(getMcpKeyStatus({ ...baseKey, expires_at: "2026-06-05T00:00:00Z" }, NOW)).toBe("expiring");
  });
});

describe("buildMcpConfig", () => {
  it("produces valid JSON with bearer header", () => {
    const parsed = JSON.parse(buildMcpConfig("meuestoque", "https://x/api/mcp", "mest_pat_k")) as {
      mcpServers: Record<string, { url: string; headers: { Authorization: string } }>;
    };
    expect(parsed.mcpServers.meuestoque.url).toBe("https://x/api/mcp");
    expect(parsed.mcpServers.meuestoque.headers.Authorization).toBe("Bearer mest_pat_k");
  });
});
