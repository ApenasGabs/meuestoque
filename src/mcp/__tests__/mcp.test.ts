import { describe, it, expect, vi } from "vitest";
import { authenticateRequest } from "../auth";
import { registerStockTools } from "../tools/stock";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: vi.fn(() => ({
      auth: {
        getUser: vi.fn(async (token) => {
          if (token === "valid") return { data: { user: { id: "u1" } }, error: null };
          return { data: { user: null }, error: { message: "Invalid" } };
        })
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null })
      }))
    }))
  };
});

describe("MCP Auth", () => {
  it("throws on missing header", async () => {
    await expect(authenticateRequest(null)).rejects.toThrow("Authorization header ausente ou invalido");
  });

  it("throws on invalid token", async () => {
    await expect(authenticateRequest("Bearer invalid")).rejects.toThrow("Token invalido ou expirado");
  });
});

describe("MCP Tools (Stock)", () => {
  it("registers tools correctly", () => {
    const mockServer = { registerTool: vi.fn() };
    registerStockTools(mockServer as unknown);
    expect(mockServer.registerTool).toHaveBeenCalled();
  });
});
