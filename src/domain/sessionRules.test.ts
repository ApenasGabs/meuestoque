import { describe, expect, it } from "vitest";
import {
  pickActiveGroup,
  shouldRedirectToGroup,
  shouldRedirectToList,
} from "./sessionRules";

describe("sessionRules", () => {
  it("prefers saved group when available", () => {
    const groups = [
      { id: "a", nome: "Casa", codigo_convite: "AAAA" },
      { id: "b", nome: "Trabalho", codigo_convite: "BBBB" },
    ];

    expect(pickActiveGroup(groups, "b")?.id).toBe("b");
  });

  it("falls back to first group when no saved group matches", () => {
    const groups = [{ id: "a", nome: "Casa", codigo_convite: "AAAA" }];

    expect(pickActiveGroup(groups, "missing")?.id).toBe("a");
  });

  it("exposes redirect decisions", () => {
    expect(shouldRedirectToGroup(true, false)).toBe(true);
    expect(shouldRedirectToList(true, true)).toBe(true);
  });
});
