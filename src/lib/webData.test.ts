import { describe, expect, it } from "vitest";
import { normalizeInviteCode } from "../domain/listRules";
import { pickActiveGroup } from "../domain/sessionRules";

describe("web data helpers", () => {
  it("normalizes invite code", () => {
    expect(normalizeInviteCode(" abcd-1234 ")).toBe("ABCD-1234");
  });

  it("prefers the saved group when restoring context", () => {
    const groups = [
      { id: "1", nome: "Casa", codigo_convite: "AAAA" },
      { id: "2", nome: "Trabalho", codigo_convite: "BBBB" },
    ];

    expect(pickActiveGroup(groups, "2")?.id).toBe("2");
  });
});
