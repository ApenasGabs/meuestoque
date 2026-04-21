import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { supabase } from "../lib/supabase";
import {
  ensureActiveListForGroup,
  loadMembers,
  loadUserGroups,
  type MemberRecord,
} from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { useGroupStore } from "../stores/groupStore";
import { useStockStore } from "../stores/stockStore";

export function ProfilePage() {
  const navigate = useNavigate();
  const userName = useAuthStore((state) => state.userName);
  const userId = useAuthStore((state) => state.userId);
  const groupId = useGroupStore((state) => state.groupId);
  const groupName = useGroupStore((state) => state.groupName);
  const groupCode = useGroupStore((state) => state.groupCode);
  const allGroups = useGroupStore((state) => state.allGroups);
  const setGroup = useGroupStore((state) => state.setGroup);
  const setListId = useGroupStore((state) => state.setListId);
  const setAllGroups = useGroupStore((state) => state.setAllGroups);
  const clearAllGroupState = useGroupStore((state) => state.clearAllGroupState);
  const clearStock = useStockStore((state) => state.clearStock);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProfileData() {
      if (!userId) return;

      try {
        const groups = await loadUserGroups(userId);
        setAllGroups(groups);
        if (groupId) {
          const groupMembers = await loadMembers(groupId);
          setMembers(groupMembers);
        } else {
          setMembers([]);
        }
      } catch (profileError) {
        setError(profileError instanceof Error ? profileError.message : "Falha ao carregar perfil");
      }
    }

    void loadProfileData();
  }, [groupId, setAllGroups, userId]);

  async function handleSwitchGroup(targetGroupId: string) {
    const targetGroup = allGroups.find((group) => group.id === targetGroupId);
    if (!targetGroup) return;

    setLoading(true);
    setError(null);

    try {
      setGroup(targetGroup.id, targetGroup.nome, targetGroup.codigo_convite);
      const list = await ensureActiveListForGroup(targetGroup.id);
      setListId(list.id);
      navigate("/list");
    } catch (switchError) {
      setError(switchError instanceof Error ? switchError.message : "Falha ao trocar de grupo");
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyCode() {
    if (!groupCode || !navigator.clipboard) return;
    await navigator.clipboard.writeText(groupCode);
  }

  async function handleLogout() {
    setLoading(true);
    setError(null);

    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        throw new Error(signOutError.message);
      }

      useAuthStore.getState().clearUser();
      clearAllGroupState();
      clearStock();
      navigate("/login");
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Falha ao sair");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div>
          <h1>Perfil</h1>
          <p>{userName ?? "Usuário autenticado"}</p>
        </div>
        <Button type="button" variant="ghost" onClick={() => navigate("/list")}>
          Voltar
        </Button>
      </header>

      {error && <Alert type="error">{error}</Alert>}

      <Card className="card form">
        <CardBody>
          <p className="section-title">Grupo ativo</p>
          <h2>{groupName ?? "Sem grupo"}</h2>
          <p className="muted">{groupCode ?? "Sem código"}</p>
          <div className="actions-row">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCopyCode}
              disabled={!groupCode}
            >
              Copiar código
            </Button>
            <Button
              type="button"
              variant="accent"
              className="danger"
              onClick={handleLogout}
              disabled={loading}
            >
              Sair da conta
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="card form">
        <CardBody>
          <h2>Membros</h2>
          {members.length === 0 ? (
            <p className="muted">Nenhum membro encontrado.</p>
          ) : (
            <div className="stack-list">
              {members.map((member) => (
                <article key={member.id} className="member-item">
                  <Badge variant="info">{member.nome}</Badge>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="card form">
        <CardBody>
          <h2>Trocar grupo</h2>
          {allGroups.length === 0 ? (
            <p className="muted">Nenhum grupo disponível.</p>
          ) : (
            <div className="stack-list">
              {allGroups.map((group) => (
                <article key={group.id} className="group-item">
                  <div>
                    <strong>{group.nome}</strong>
                    <p>{group.codigo_convite}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleSwitchGroup(group.id)}
                    disabled={loading}
                  >
                    Usar
                  </Button>
                </article>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </main>
  );
}
