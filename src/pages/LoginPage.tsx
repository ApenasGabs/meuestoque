import type { FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Card, CardBody, CardTitle } from "../components/Card/Card";
import { Input } from "../components/Input/Input";
import { supabase } from "../lib/supabase";
import { restoreGroupContext } from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { getPersistedGroupSnapshotForUser, useGroupStore } from "../stores/groupStore";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      const userName = data.user.user_metadata?.nome ?? data.user.email ?? "";
      useAuthStore.getState().setUser(data.user.id, userName);
      useGroupStore.getState().setSnapshotUserId(data.user.id);
      const persistedSnapshot = getPersistedGroupSnapshotForUser(data.user.id);

      const currentGroupId =
        useGroupStore.getState().groupId ??
        useGroupStore.getState().lastGroupId ??
        persistedSnapshot?.lastGroupId ??
        persistedSnapshot?.groupId ??
        null;
      const context = await restoreGroupContext(data.user.id, currentGroupId);
      useGroupStore.getState().setAllGroups(context.groups);

      if (context.group) {
        useGroupStore
          .getState()
          .setGroup(context.group.id, context.group.nome, context.group.codigo_convite);
        useGroupStore
          .getState()
          .setListId(
            context.listId ?? persistedSnapshot?.lastListId ?? persistedSnapshot?.listId ?? null,
          );
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
        useGroupStore.getState().clearGroup();
        navigate("/group");
      }
    }

    setLoading(false);
  }

  return (
    <main className="page auth">
      <Card>
        <CardBody>
          <CardTitle>Compras em Dois</CardTitle>
          <p>Entrar na sua conta</p>

          <form onSubmit={onSubmit} className="form mt-6">
            <Input
              label="E-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
            />
            <Input
              label="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
            />

            {error && <Alert type="error">{error}</Alert>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </CardBody>
      </Card>

      <p>
        Não tem conta?{" "}
        <Button variant="ghost" size="sm" onClick={() => navigate("/register")}>
          Criar conta
        </Button>
      </p>
    </main>
  );
}
