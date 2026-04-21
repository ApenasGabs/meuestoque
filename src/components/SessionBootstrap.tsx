import { useEffect } from "react";
import { supabase } from "../lib/supabase";
import { restoreGroupContext } from "../lib/webData";
import { useAuthStore } from "../stores/authStore";
import { getPersistedGroupSnapshotForUser, useGroupStore } from "../stores/groupStore";
import { useSessionStore } from "../stores/sessionStore";

export function SessionBootstrap() {
  const setUser = useAuthStore((state) => state.setUser);
  const clearUser = useAuthStore((state) => state.clearUser);
  const { setGroup, setListId, setAllGroups, clearGroup, clearAllGroupState, setSnapshotUserId } =
    useGroupStore();
  const setReady = useSessionStore((state) => state.setReady);

  useEffect(() => {
    let active = true;
    let initialNoSessionTimer: ReturnType<typeof setTimeout> | null = null;
    const withTimeout = async <T,>(
      promise: Promise<T>,
      timeoutMs: number,
      timeoutMessage: string,
    ): Promise<T> => {
      return await Promise.race<T>([
        promise,
        new Promise<T>((_resolve, reject) => {
          setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
        }),
      ]);
    };

    const finishWithoutSession = (): void => {
      if (!active) return;

      clearUser();
      clearAllGroupState();
      setReady(true);
    };

    const clearInitialTimer = () => {
      if (initialNoSessionTimer) {
        clearTimeout(initialNoSessionTimer);
        initialNoSessionTimer = null;
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active) return;

      if (!session?.user) {
        if (_event === "INITIAL_SESSION") {
          clearInitialTimer();
          initialNoSessionTimer = setTimeout(() => {
            finishWithoutSession();
          }, 400);
          return;
        }

        clearInitialTimer();
        finishWithoutSession();
        return;
      }

      clearInitialTimer();

      setUser(session.user.id, session.user.user_metadata?.nome ?? session.user.email ?? "");
      setSnapshotUserId(session.user.id);

      const persistedSnapshot = getPersistedGroupSnapshotForUser(session.user.id);

      if (
        persistedSnapshot?.lastGroupId &&
        persistedSnapshot.groupName &&
        persistedSnapshot.groupCode
      ) {
        setGroup(
          persistedSnapshot.lastGroupId,
          persistedSnapshot.groupName,
          persistedSnapshot.groupCode,
        );
        setListId(persistedSnapshot.lastListId ?? persistedSnapshot.listId ?? null);
      }

      if (persistedSnapshot?.allGroups?.length) {
        setAllGroups(persistedSnapshot.allGroups);
      }

      try {
        const savedGroupId =
          useGroupStore.getState().groupId ??
          useGroupStore.getState().lastGroupId ??
          persistedSnapshot?.lastGroupId ??
          persistedSnapshot?.groupId ??
          null;
        const { groups, group, listId } = await withTimeout(
          restoreGroupContext(session.user.id, savedGroupId),
          6000,
          "Timeout restaurando contexto do grupo",
        );

        if (!active) return;

        const groupsToStore = groups.length > 0 ? groups : (persistedSnapshot?.allGroups ?? []);
        setAllGroups(groupsToStore);
        if (group) {
          setGroup(group.id, group.nome, group.codigo_convite);
          setListId(listId ?? persistedSnapshot?.lastListId ?? persistedSnapshot?.listId ?? null);
        } else if (
          persistedSnapshot?.lastGroupId &&
          persistedSnapshot.groupName &&
          persistedSnapshot.groupCode
        ) {
          setGroup(
            persistedSnapshot.lastGroupId,
            persistedSnapshot.groupName,
            persistedSnapshot.groupCode,
          );
          setListId(persistedSnapshot.lastListId ?? persistedSnapshot.listId ?? null);
        } else {
          clearGroup();
        }
      } catch (error) {
        console.error(error);
        if (!useGroupStore.getState().groupId) {
          clearGroup();
        }
      } finally {
        if (active) {
          setReady(true);
        }
      }
    });

    return () => {
      active = false;
      clearInitialTimer();
      subscription.unsubscribe();
    };
  }, [
    clearAllGroupState,
    clearGroup,
    clearUser,
    setGroup,
    setListId,
    setReady,
    setAllGroups,
    setSnapshotUserId,
    setUser,
  ]);

  return null;
}
