import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Badge } from "../components/Badge/Badge";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { Fieldset } from "../components/Fieldset/Fieldset";
import ThemeSelector from "../components/ThemeSelector/ThemeSelector";
import {
  FONT_SIZE_LABELS,
  FONT_SIZE_OPTIONS,
  getStoredTheme,
  useFontSizePreference,
} from "../hooks/usePreferences";
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


export const ProfilePage = (): ReactElement => {
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
  const { fontSize, setFontSize } = useFontSizePreference();
  const storedTheme = getStoredTheme();
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadProfileData = async (): Promise<void> => {
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
    };

    void loadProfileData();
  }, [groupId, setAllGroups, userId]);

  const handleSwitchGroup = async (targetGroupId: string): Promise<void> => {
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
  };

  const handleCopyCode = async (): Promise<void> => {
    if (!groupCode || !navigator.clipboard) return;

    await navigator.clipboard.writeText(groupCode);
  };

  const handleLogout = async (): Promise<void> => {
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
  };

  return (
    <main className="page pb-28 sm:pb-24">
      <header className="space-y-4 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
              Configurações
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">Perfil</h1>
            <p className="text-sm text-base-content/70">{userName ?? "Usuário autenticado"}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => navigate("/list")}>
            Voltar
          </Button>
        </div>
      </header>

      {error && <Alert type="error">{error}</Alert>}

      <Card className="card form mb-4">
        <CardBody>
          <p className="section-title">Preferências do app</p>
          <Fieldset legend="Tema">
            <ThemeSelector />
            <p className="text-xs text-base-content/60">Tema salvo: {storedTheme}</p>
          </Fieldset>

          <Fieldset legend="Tamanho da fonte">
            <div className="flex flex-wrap gap-2">
              {FONT_SIZE_OPTIONS.map((size) => (
                <Button
                  key={size}
                  variant={fontSize === size ? "primary" : "ghost"}
                  size="sm"
                  onClick={() => setFontSize(size)}
                >
                  {FONT_SIZE_LABELS[size]}
                </Button>
              ))}
            </div>
            <p className="text-xs text-base-content/60 mt-2">
              Tamanho salvo: {FONT_SIZE_LABELS[fontSize]}
            </p>
          </Fieldset>
        </CardBody>
      </Card>

      <Card className="card form mb-4">
        <CardBody>
          <p className="section-title">Grupo ativo</p>
          <h2>{groupName ?? "Sem grupo"}</h2>
          <p className="muted">{groupCode ?? "Sem código"}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void handleCopyCode()}
              disabled={!groupCode}
            >
              Copiar código
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate("/group")}
              data-testid="manage-groups-button"
            >
              Gerenciar Grupos
            </Button>
            <Button
              type="button"
              variant="accent"
              className="danger"
              onClick={() => void handleLogout()}
              disabled={loading}
              data-testid="logout-button"
            >
              Sair da conta
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="card form mb-4">
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

      <Card className="card form mb-4">
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
                    onClick={() => void handleSwitchGroup(group.id)}
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

      <Card className="card form">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h2 className="!mb-0">Sobre o App</h2>
            <Badge variant="accent" className="font-mono text-xs">v{typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.7.0'}</Badge>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-base-content/80">Últimas Atualizações</h3>
            <div className="stack-list max-h-64 overflow-y-auto pr-2">
              {(typeof __APP_CHANGELOG__ !== 'undefined' ? __APP_CHANGELOG__ : []).map((entry) => (
                <article key={entry.version} className="border border-base-200 p-3 rounded-lg bg-base-100/50">
                  <div className="flex justify-between items-center mb-2">
                    <strong className="text-primary font-mono text-sm">v{entry.version}</strong>
                    <span className="text-xs text-base-content/60">{entry.date}</span>
                  </div>
                  
                  {entry.features && entry.features.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-success mb-1 block">✨ Novidades</span>
                      <ul className="list-disc list-inside text-sm text-base-content/80 space-y-1">
                        {entry.features.map((feature: string, idx: number) => (
                          <li key={idx} className="leading-tight">{feature}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {entry.fixes && entry.fixes.length > 0 && (
                    <div>
                      <span className="text-xs font-semibold uppercase tracking-wider text-warning mb-1 block">🐛 Correções</span>
                      <ul className="list-disc list-inside text-sm text-base-content/80 space-y-1">
                        {entry.fixes.map((fix: string, idx: number) => (
                          <li key={idx} className="leading-tight">{fix}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </article>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>
    </main>
  );
};
