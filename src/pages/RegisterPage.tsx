import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import { Input } from "../components/Input/Input";
import { supabase } from "../lib/supabase";
import { restoreGroupContext } from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { getPersistedGroupSnapshotForUser, useGroupStore } from "../stores/groupStore";

export function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e: FormEvent): Promise<void> => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const emailRedirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/login` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome: name }, emailRedirectTo },
      });

      if (error) {
        setError(error.message);
        return;
      }

      if (data.user) {
        useAuthStore
          .getState()
          .setUser(data.user.id, data.user.user_metadata?.nome ?? data.user.email ?? "");
        useGroupStore.getState().setSnapshotUserId(data.user.id);
        const persistedSnapshot = getPersistedGroupSnapshotForUser(data.user.id);

        const context = await restoreGroupContext(
          data.user.id,
          useGroupStore.getState().groupId ??
            useGroupStore.getState().lastGroupId ??
            persistedSnapshot?.lastGroupId ??
            persistedSnapshot?.groupId ??
            null,
        );
        useGroupStore.getState().setAllGroups(context.groups);

        if (context.group) {
          useGroupStore
            .getState()
            .setGroup(context.group.id, context.group.nome, context.group.codigo_convite);
          useGroupStore.getState().setListId(context.listId ?? null);
          navigate("/list");
        } else if (
          persistedSnapshot?.lastGroupId &&
          persistedSnapshot.groupName &&
          persistedSnapshot.groupCode
        ) {
          useGroupStore
            .getState()
            .setGroup(
              persistedSnapshot.lastGroupId,
              persistedSnapshot.groupName,
              persistedSnapshot.groupCode,
            );
          useGroupStore
            .getState()
            .setListId(persistedSnapshot.lastListId ?? persistedSnapshot.listId ?? null);
          navigate("/list");
        } else {
          navigate("/group");
        }
      } else {
        navigate("/login");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page auth">
      <Card>
        <CardBody>
          <h1 className="text-2xl font-bold mb-4">Criar conta</h1>
          <p>Cadastro web inicial</p>

          <form onSubmit={onSubmit} className="form mt-6">
            <Input
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              data-testid="register-name"
            />
            <Input
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              data-testid="register-email"
            />
            <Input
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              data-testid="register-password"
            />
            <Input
              label="Confirmar senha"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              required
              helperText="Digite a senha novamente para confirmar."
              data-testid="register-confirm-password"
            />

            {error && (
              <Alert type="error" data-testid="register-error">
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              data-testid="register-submit"
            >
              {loading ? "Criando..." : "Criar conta"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p>
        Já tem conta?{" "}
        <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
          Entrar
        </Button>
      </p>
    </main>
  );
}
