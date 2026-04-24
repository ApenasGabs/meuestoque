import { describe, expect, it } from "vitest";
import {
  pickActiveGroup,
  shouldRedirectToGroup,
  shouldRedirectToList,
  shouldSyncSubdomain,
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

describe("shouldSyncSubdomain", () => {
  it("returns shared domain when user has group but is on solo domain", () => {
    expect(shouldSyncSubdomain("meuestoque.apenasgabs.dev", true)).toBe(
      "nossoestoque.apenasgabs.dev",
    );
  });

  it("returns solo domain when user has no group but is on shared domain", () => {
    expect(shouldSyncSubdomain("nossoestoque.apenasgabs.dev", false)).toBe(
      "meuestoque.apenasgabs.dev",
    );
  });

  it("returns null when already on the correct domain", () => {
    expect(shouldSyncSubdomain("meuestoque.apenasgabs.dev", false)).toBeNull();
    expect(shouldSyncSubdomain("nossoestoque.apenasgabs.dev", true)).toBeNull();
  });

  it("returns null on unknown hosts (localhost, Vercel preview, etc.)", () => {
    expect(shouldSyncSubdomain("localhost", true)).toBeNull();
    expect(shouldSyncSubdomain("meuestoque-preview.vercel.app", false)).toBeNull();
  });
});

