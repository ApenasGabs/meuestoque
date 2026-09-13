import { describe, expect, it, vi } from "vitest";
import { normalizeInviteCode } from "../domain/listRules";
import { pickActiveGroup } from "../domain/sessionRules";
import { addListItem, updateListItemName } from "./webData";
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
});
