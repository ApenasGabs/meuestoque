import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpKeysSection } from "./McpKeysSection";
import * as mcpKeysLib from "../../lib/mcpKeys";

vi.mock("../../lib/mcpKeys", async (importOriginal) => {
  const actual = await importOriginal<typeof mcpKeysLib>();
  return {
    ...actual,
    listMcpKeys: vi.fn(),
    createMcpKey: vi.fn(),
    revokeMcpKey: vi.fn(),
    revokeAllMcpKeys: vi.fn(),
  };
});

describe("McpKeysSection Component", () => {
  const mockKeys: mcpKeysLib.McpApiKey[] = [
    {
      id: "key-1",
      name: "Claude Desktop",
      key_prefix: "mest_pat_abcdef",
      scopes: ["read", "write"],
      created_at: "2026-10-10T12:00:00Z",
      last_used_at: "2026-10-11T15:00:00Z",
      expires_at: "2027-01-10T12:00:00Z",
      revoked_at: null,
    },
    {
      id: "key-2",
      name: "Cursor ReadOnly",
      key_prefix: "mest_pat_123456",
      scopes: ["read"],
      created_at: "2026-10-01T12:00:00Z",
      last_used_at: null,
      expires_at: "2026-10-02T12:00:00Z",
      revoked_at: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mcpKeysLib.listMcpKeys).mockResolvedValue(mockKeys);
  });

  it("renderiza lista de chaves e formulario de criacao", async () => {
    render(<McpKeysSection appName="meuestoque" appTitle="MeuEstoque" />);

    expect(screen.getByTestId("mcp-keys-section")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-key-create-form")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId("mcp-key-item-key-1")).toBeInTheDocument();
      expect(screen.getByTestId("mcp-key-item-key-2")).toBeInTheDocument();
    });

    expect(screen.getByText("Claude Desktop")).toBeInTheDocument();
    expect(screen.getByText("Cursor ReadOnly")).toBeInTheDocument();
    expect(screen.getByText("leitura")).toBeInTheDocument();
  });

  it("exibe mensagem de vazio quando nao ha chaves cadastradas", async () => {
    vi.mocked(mcpKeysLib.listMcpKeys).mockResolvedValue([]);
    render(<McpKeysSection appName="meuestoque" appTitle="MeuEstoque" />);

    await waitFor(() => {
      expect(screen.getByTestId("mcp-keys-empty")).toBeInTheDocument();
    });
  });

  it("cria nova chave e exibe modal com o segredo uma unica vez", async () => {
    vi.mocked(mcpKeysLib.createMcpKey).mockResolvedValue({
      id: "key-3",
      apiKey: "mest_pat_supersecretkey123456789012345678901234",
      keyPrefix: "mest_pat_supers",
      expiresAt: "2027-01-10T12:00:00Z",
    });

    render(<McpKeysSection appName="meuestoque" appTitle="MeuEstoque" />);

    const nameInput = screen.getByTestId("mcp-key-name-input");
    const createBtn = screen.getByTestId("mcp-key-create-button");

    fireEvent.change(nameInput, { target: { value: "Antigravity Dev" } });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(mcpKeysLib.createMcpKey).toHaveBeenCalledWith("Antigravity Dev", 90, ["read", "write"]);
    });

    expect(await screen.findByTestId("mcp-key-created-modal")).toBeInTheDocument();
    expect(screen.getByTestId("mcp-key-secret")).toHaveTextContent(
      "mest_pat_supersecretkey123456789012345678901234",
    );

    const closeBtn = screen.getByTestId("mcp-key-modal-close");
    fireEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByTestId("mcp-key-created-modal")).not.toBeInTheDocument();
    });
  });

  it("permite revogar chave individual apos confirmacao", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(mcpKeysLib.revokeMcpKey).mockResolvedValue();

    render(<McpKeysSection appName="meuestoque" appTitle="MeuEstoque" />);

    const revokeBtn = await screen.findByTestId("mcp-key-revoke-key-1");
    fireEvent.click(revokeBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mcpKeysLib.revokeMcpKey).toHaveBeenCalledWith("key-1");
    });
  });

  it("permite revogar todas as chaves apos confirmacao", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(mcpKeysLib.revokeAllMcpKeys).mockResolvedValue(2);

    render(<McpKeysSection appName="meuestoque" appTitle="MeuEstoque" />);

    const revokeAllBtn = await screen.findByTestId("mcp-key-revoke-all-button");
    fireEvent.click(revokeAllBtn);

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(mcpKeysLib.revokeAllMcpKeys).toHaveBeenCalled();
    });
  });
});
