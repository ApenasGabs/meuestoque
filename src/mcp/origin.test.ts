import { describe, expect, it } from "vitest";
import { getRequestOrigin } from "./origin";

describe("getRequestOrigin", () => {
  it("prioriza x-forwarded-host e x-forwarded-proto quando presentes", () => {
    const req = new Request("http://internal:3000/api/mcp", {
      headers: {
        "x-forwarded-host": "meuestoque.apenasgabs.dev",
        "x-forwarded-proto": "https",
      },
    });
    expect(getRequestOrigin(req)).toBe("https://meuestoque.apenasgabs.dev");
  });

  it("utiliza header host se x-forwarded-host não estiver presente", () => {
    const req = new Request("http://localhost:5174/api/mcp", {
      headers: {
        host: "localhost:5174",
      },
    });
    expect(getRequestOrigin(req)).toBe("https://localhost:5174");
  });

  it("recai para url.host se nenhum header de proxy estiver presente", () => {
    const req = new Request("https://preview.vercel.app/api/mcp");
    expect(getRequestOrigin(req)).toBe("https://preview.vercel.app");
  });
});
