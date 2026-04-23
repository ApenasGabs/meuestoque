import {
  buildQuantityLabel,
  calculateShoppingTotal,
  filterItemsByCategory,
  normalizeInviteCode,
  type ListItem,
} from "./listRules";

describe("listRules", () => {
  it("normalizes invite code with trim and uppercase", () => {
    expect(normalizeInviteCode(" abcd-1234 ")).toBe("ABCD-1234");
  });

  it("builds quantity with sane defaults", () => {
    expect(buildQuantityLabel("", "")).toBe("1 un");
    expect(buildQuantityLabel("2", "kg")).toBe("2 kg");
  });

  it("calculates shopping total ignoring null prices", () => {
    const total = calculateShoppingTotal([
      { preco: 10.5 },
      { preco: null },
      { preco: 2 },
    ]);

    expect(total).toBe(12.5);
  });

  it("filters category preserving the mobile rule for emoji labels", () => {
    const items: ListItem[] = [
      { id: "1", nome: "Arroz", categoria: "Grãos", preco: null },
      { id: "2", nome: "Leite", categoria: "Laticínios", preco: null },
    ];

    expect(filterItemsByCategory(items, "Todos")).toHaveLength(2);
    expect(filterItemsByCategory(items, "🌾 Grãos")).toEqual([items[0]]);
  });
});
