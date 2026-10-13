import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  buildMcpConfig,
  createMcpKey,
  getMcpKeyStatus,
  listMcpKeys,
  revokeAllMcpKeys,
  revokeMcpKey,
  type CreatedMcpApiKey,
  type McpApiKey,
  type McpKeyScope,
  type McpKeyStatus,
} from "../../lib/mcpKeys";
import { Alert } from "../Alert/Alert";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";

interface McpKeysSectionProps {
  appName: string;
  appTitle: string;
}

const DAY_OPTIONS = [30, 90, 365] as const;

const STATUS_LABEL: Record<McpKeyStatus, string> = {
  active: "Ativa",
  expiring: "Expira em breve",
  expired: "Expirada",
  revoked: "Revogada",
};

const STATUS_CLASS: Record<McpKeyStatus, string> = {
  active: "badge-success",
  expiring: "badge-warning",
  expired: "badge-ghost",
  revoked: "badge-error",
};

const formatDate = (iso: string | null): string =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "Nunca";

/**
 * Gerenciamento de chaves persistentes do servidor MCP (criar, listar, revogar).
 * O segredo completo so e exibido uma vez, logo apos a criacao.
 */
export const McpKeysSection = ({ appName, appTitle }: McpKeysSectionProps): ReactElement => {
  const [keys, setKeys] = useState<McpApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [days, setDays] = useState<number>(90);
  const [readOnly, setReadOnly] = useState(false);
  const [created, setCreated] = useState<CreatedMcpApiKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const mcpUrl = `https://${appName}.apenasgabs.dev/api/mcp`;

  const refresh = useCallback(async (): Promise<void> => {
    try {
      setKeys(await listMcpKeys());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar chaves");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const scopes: McpKeyScope[] = readOnly ? ["read"] : ["read", "write"];
      setCreated(await createMcpKey(name.trim(), days, scopes));
      setName("");
      await refresh();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Falha ao criar chave");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (id: string): Promise<void> => {
    if (!window.confirm("Revogar esta chave? Clientes que a utilizam perderão acesso imediatamente.")) return;
    setBusy(true);
    try {
      await revokeMcpKey(id);
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Falha ao revogar");
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeAll = async (): Promise<void> => {
    if (!window.confirm("Revogar TODAS as chaves MCP ativas?")) return;
    setBusy(true);
    try {
      await revokeAllMcpKeys();
      await refresh();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Falha ao revogar");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (label: string, text: string): Promise<void> => {
    if (!navigator.clipboard) return;
    await navigator.clipboard.writeText(text);
    setCopied(label);
  };

  const closeCreated = (): void => {
    setCreated(null);
    setCopied(null);
  };

  const hasActive = keys.some((k) => {
    const status = getMcpKeyStatus(k);
    return status === "active" || status === "expiring";
  });

  return (
    <div className="space-y-4" data-testid="mcp-keys-section">
      {error && <Alert type="error">{error}</Alert>}

      <form className="space-y-3" onSubmit={(e) => void handleCreate(e)} data-testid="mcp-key-create-form">
        <label className="form-control w-full">
          <span className="label-text text-sm">Nome da integração</span>
          <input
            className="input input-bordered w-full"
            placeholder="Ex: Claude Desktop - Notebook"
            maxLength={60}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="mcp-key-name-input"
          />
        </label>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="form-control">
            <span className="label-text text-sm">Validade</span>
            <select
              className="select select-bordered select-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              data-testid="mcp-key-days-select"
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} dias
                </option>
              ))}
            </select>
          </label>
          <label className="label cursor-pointer gap-2">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={readOnly}
              onChange={(e) => setReadOnly(e.target.checked)}
              data-testid="mcp-key-readonly-checkbox"
            />
            <span className="label-text text-sm">Somente leitura</span>
          </label>
          <Button type="submit" variant="secondary" size="sm" disabled={busy || !name.trim()} data-testid="mcp-key-create-button">
            Gerar chave
          </Button>
        </div>
      </form>

      {keys.length === 0 ? (
        <p className="muted" data-testid="mcp-keys-empty">Nenhuma chave criada.</p>
      ) : (
        <ul className="space-y-2" data-testid="mcp-keys-list">
          {keys.map((key) => {
            const status = getMcpKeyStatus(key);
            const canRevoke = status === "active" || status === "expiring";
            return (
              <li key={key.id} className="bg-base-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2" data-testid={`mcp-key-item-${key.id}`}>
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <strong className="truncate">{key.name}</strong>
                    <span className={`badge badge-sm ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>
                    {!key.scopes.includes("write") && <Badge variant="info" className="badge-sm">leitura</Badge>}
                  </div>
                  <p className="text-xs font-mono text-base-content/70">{key.key_prefix}...</p>
                  <p className="text-xs text-base-content/60">
                    Criada {formatDate(key.created_at)} · Último uso {formatDate(key.last_used_at)} · Expira {formatDate(key.expires_at)}
                  </p>
                </div>
                {canRevoke && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void handleRevoke(key.id)} data-testid={`mcp-key-revoke-${key.id}`}>
                    Revogar
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasActive && (
        <Button type="button" variant="ghost" size="sm" className="text-error" disabled={busy} onClick={() => void handleRevokeAll()} data-testid="mcp-key-revoke-all-button">
          Revogar todas
        </Button>
      )}

      {created && (
        <dialog className="modal modal-open" data-testid="mcp-key-created-modal">
          <div className="modal-box space-y-4">
            <h3 className="font-semibold text-lg">Chave criada</h3>
            <div role="alert" className="alert alert-warning text-sm">
              Copie esta chave agora. Ela não será exibida novamente.
            </div>
            <code className="block bg-base-200 p-3 rounded-lg text-xs font-mono break-all" data-testid="mcp-key-secret">
              {created.apiKey}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void copy("key", created.apiKey)} data-testid="mcp-key-copy-key">
                {copied === "key" ? "Copiada" : "Copiar chave"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void copy("json", buildMcpConfig(appName, mcpUrl, created.apiKey))} data-testid="mcp-key-copy-json">
                {copied === "json" ? "Copiado" : "Copiar JSON"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() =>
                  void copy(
                    "prompt",
                    `IA, configure a integração MCP com o ${appTitle} adicionando este servidor à sua configuração de ferramentas MCP:\n\n${buildMcpConfig(appName, mcpUrl, created.apiKey)}\n\nAssim que configurar, me avise para testarmos a conexão.`,
                  )
                }
                data-testid="mcp-key-copy-prompt"
              >
                {copied === "prompt" ? "Copiado" : "Copiar prompt p/ IA"}
              </Button>
            </div>
            <div className="modal-action">
              <Button type="button" variant="ghost" onClick={closeCreated} data-testid="mcp-key-modal-close">
                Já copiei, fechar
              </Button>
            </div>
          </div>
        </dialog>
      )}
    </div>
  );
};
