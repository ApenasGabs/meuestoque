import { describe, expect, it, vi } from "vitest";
import { normalizeInviteCode } from "../domain/listRules";
import { pickActiveGroup } from "../domain/sessionRules";
import { addListItem, updateListItemName, duplicateShoppingListToActive } from "./webData";
import { supabase } from "./supabase";

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

  it("addListItem extrai e persiste marca e produto_base automaticamente", async () => {
    const insertMock = vi.fn().mockResolvedValueOnce({ error: null });
    vi.spyOn(supabase, "from").mockReturnValueOnce({
      insert: insertMock,
    } as unknown as ReturnType<typeof supabase.from>);

    await addListItem({
      listId: "list-1",
      nome: "Feijão Preto Camil Tipo 1 1kg",
      quantidade: "2 un",
      categoria: "Grãos",
    });

    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Feijão Preto Camil Tipo 1 1kg",
        marca: "Camil",
        produto_base: "Feijão Preto",
      }),
    );
  });

  it("updateListItemName re-extrai e atualiza marca e produto_base", async () => {
    const eqMock = vi.fn().mockResolvedValueOnce({ error: null });
    const updateMock = vi.fn().mockReturnValueOnce({ eq: eqMock });
    vi.spyOn(supabase, "from").mockReturnValueOnce({
      update: updateMock,
    } as unknown as ReturnType<typeof supabase.from>);

    await updateListItemName("item-1", "Detergente Ypê Coco 500ml");

    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        nome: "Detergente Ypê Coco 500ml",
        marca: "Ypê",
        produto_base: "Detergente Coco",
      }),
    );
    expect(eqMock).toHaveBeenCalledWith("id", "item-1");
  });

  it("duplicateShoppingListToActive extrai marca e produto_base ao duplicar itens", async () => {
    // Mock loadListItems para sourceList
    const selectSourceMock = vi.fn().mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({
          data: [
            {
              id: "src-1",
              nome: "Café Pilão Tradicional 500g",
              quantidade: "1 un",
              categoria: "Mercearia",
              preco: 18.5,
              comprado: false,
              criado_por: "user-1",
            },
          ],
          error: null,
        }),
      }),
    });

    // Mock ensureActiveListForGroup
    const selectActiveListMock = vi.fn().mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        or: vi.fn().mockReturnValueOnce({
          limit: vi.fn().mockResolvedValueOnce({
            data: [{ id: "active-list-1" }],
            error: null,
          }),
        }),
      }),
    });

    // Mock loadListItems para targetList (vazio)
    const selectTargetMock = vi.fn().mockReturnValueOnce({
      eq: vi.fn().mockReturnValueOnce({
        order: vi.fn().mockResolvedValueOnce({
          data: [],
          error: null,
        }),
      }),
    });

    // Mock insert para novos itens
    const insertMock = vi.fn().mockResolvedValueOnce({ error: null });

    let fromCallCount = 0;
    vi.spyOn(supabase, "from").mockImplementation((table: string) => {
      if (table === "shopping_lists") {
        return { select: selectActiveListMock } as unknown as ReturnType<typeof supabase.from>;
      }
      if (table === "items") {
        fromCallCount++;
        if (fromCallCount === 1)
          return { select: selectSourceMock } as unknown as ReturnType<typeof supabase.from>;
        if (fromCallCount === 2)
          return { select: selectTargetMock } as unknown as ReturnType<typeof supabase.from>;
        if (fromCallCount === 3)
          return { insert: insertMock } as unknown as ReturnType<typeof supabase.from>;
      }
      return {} as unknown as ReturnType<typeof supabase.from>;
    });

    const result = await duplicateShoppingListToActive("group-1", "source-list-1");

    expect(result.duplicatedCount).toBe(1);
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          nome: "Café Pilão Tradicional 500g",
          marca: "Pilão",
          produto_base: "Café Tradicional",
        }),
      ]),
    );
  });
});
