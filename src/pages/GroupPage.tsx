/** @jsxImportSource react */
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody, CardTitle } from "../components/Card/Card";
import { Input } from "../components/Input/Input";
import { normalizeInviteCode } from "../domain/listRules";
import {
  createGroupForCurrentUser,
  ensureActiveListForGroup,
  joinGroupByCode,
  leaveGroup,
  loadUserGroups,
} from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";

export function GroupPage() {
  const [groupName, setGroupName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const userName = useAuthStore((state) => state.userName);
  const groupId = useGroupStore((state) => state.groupId);
  const groupNameActive = useGroupStore((state) => state.groupName);
  const groupCode = useGroupStore((state) => state.groupCode);
  const allGroups = useGroupStore((state) => state.allGroups);
  const setGroup = useGroupStore((state) => state.setGroup);
  const setListId = useGroupStore((state) => state.setListId);
  const setAllGroups = useGroupStore((state) => state.setAllGroups);
  const clearGroup = useGroupStore((state) => state.clearGroup);

  useEffect(() => {
    async function syncGroups() {
      if (!userId) return;
      const groups = await loadUserGroups(userId);
      setAllGroups(groups);
    }

    syncGroups().catch((syncError) => setError(syncError.message));
  }, [setAllGroups, userId]);

  async function refreshGroups() {
    if (!userId) return;
    const groups = await loadUserGroups(userId);
    setAllGroups(groups);
  }

  async function handleCreateGroup(e: FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const created = await createGroupForCurrentUser(groupName.trim());
      setGroup(created.groupId, created.groupName, created.inviteCode);
      setListId(created.listId);
      setSuccessCode(created.inviteCode);
      await refreshGroups();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Falha ao criar grupo",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleJoinGroup(e: FormEvent) {
    e.preventDefault();
    if (!inviteCode.trim() || !userId) return;

    setLoading(true);
    setError(null);

    try {
      const joined = await joinGroupByCode(
        normalizeInviteCode(inviteCode),
        userId,
      );
      setGroup(joined.groupId, joined.groupName, joined.inviteCode);
      setListId(joined.listId);
      setSuccessCode(null);
      await refreshGroups();
      navigate("/list");
    } catch (joinError) {
      setError(
        joinError instanceof Error
          ? joinError.message
          : "Falha ao entrar no grupo",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleUseGroup(targetGroupId: string) {
    if (!userId) return;

    const targetGroup = allGroups.find((group) => group.id === targetGroupId);
    if (!targetGroup) return;

    setLoading(true);
    setError(null);

    try {
      setGroup(targetGroup.id, targetGroup.nome, targetGroup.codigo_convite);
      const activeList = await ensureActiveListForGroup(targetGroup.id);
      setListId(activeList.id);
      navigate("/list");
    } catch (switchError) {
      setError(
        switchError instanceof Error
          ? switchError.message
          : "Falha ao trocar de grupo",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleLeaveGroup() {
    if (!groupId || !userId) return;

    setLoading(true);
    setError(null);

    try {
      await leaveGroup(groupId, userId);
      clearGroup();
      await refreshGroups();
      navigate("/group");
    } catch (leaveError) {
      setError(
        leaveError instanceof Error
          ? leaveError.message
          : "Falha ao sair do grupo",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyInviteCode() {
    if (!groupCode || !navigator.clipboard) return;
    await navigator.clipboard.writeText(groupCode);
  }

  return (
    <main className="page">
      <Card className="mb-6">
        <CardBody>
          <CardTitle>Grupo</CardTitle>
          <p>
            {userName
              ? `Olá, ${userName}`
              : "Crie ou entre em um grupo para continuar."}
          </p>

          {error && (
            <div className="mt-4">
              <Alert type="error">{error}</Alert>
            </div>
          )}

          <section className="mt-6 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-semibold">
                {groupNameActive ?? "Nenhum grupo ativo"}
              </h2>
              {groupCode ? <Badge variant="info">{groupCode}</Badge> : null}
            </div>
            <p className="muted">
              {groupCode
                ? `Código: ${groupCode}`
                : "Nenhum código disponível no momento."}
            </p>
            {groupId && (
              <div className="actions-row">
                <Button type="button" onClick={copyInviteCode}>
                  Copiar código
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate("/list")}
                >
                  Ir para a lista
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleLeaveGroup}
                  disabled={loading}
                >
                  Sair do grupo
                </Button>
              </div>
            )}
          </section>
        </CardBody>
      </Card>

      {successCode && (
        <Card className="mb-6">
          <CardBody>
            <CardTitle>Convite criado</CardTitle>
            <Badge variant="success">{successCode}</Badge>
            <p className="muted mt-3">
              Compartilhe este código com quem vai participar do grupo.
            </p>
            <div className="actions-row mt-4">
              <Button type="button" onClick={copyInviteCode}>
                Copiar código
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/list")}
              >
                Continuar
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="grid">
        <Card>
          <CardBody>
            <CardTitle>Criar grupo</CardTitle>
            <form className="form" onSubmit={handleCreateGroup}>
              <Input
                label="Nome do grupo"
                value={groupName}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setGroupName(e.target.value)
                }
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Salvando..." : "Criar"}
              </Button>
            </form>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <CardTitle>Entrar com código</CardTitle>
            <form className="form" onSubmit={handleJoinGroup}>
              <Input
                label="Código"
                value={inviteCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setInviteCode(e.target.value)
                }
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <CardTitle>Meus grupos</CardTitle>
          {allGroups.length === 0 ? (
            <p className="muted">Nenhum grupo encontrado.</p>
          ) : (
            <div className="stack-list">
              {allGroups.map((group) => (
                <article
                  key={group.id}
                  className={
                    group.id === groupId ? "group-item active" : "group-item"
                  }
                >
                  <div>
                    <strong>{group.nome}</strong>
                    <p>{group.codigo_convite}</p>
                  </div>
                  <div className="actions-row">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleUseGroup(group.id)}
                      disabled={loading}
                    >
                      Usar
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <nav className="tabs">
        <Button type="button" variant="ghost" onClick={() => navigate("/list")}>
          Lista
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/history")}
        >
          Historico
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => navigate("/profile")}
        >
          Perfil
        </Button>
      </nav>
    </main>
  );
}
