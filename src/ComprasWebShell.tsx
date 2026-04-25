import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "./components/Button/Button";
import { Footer } from "./components/Footer/Footer";
import { Navbar } from "./components/Navbar/Navbar";
import { PublicOnly, RequireAuth, RequireGroup } from "./components/RouteGuards";
import { useAppMode } from "./hooks/useAppMode";
import { useSubdomainSync } from "./hooks/useSubdomainSync";
import { GroupPage } from "./pages/GroupPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ListPageNew } from "./pages/ListPageNew";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RegisterPage } from "./pages/RegisterPage";
import { StockItemDetailsPage } from "./pages/StockItemDetailsPage";
import { StockPageNew } from "./pages/StockPageNew";
import { useAuthStore } from "./stores/authStore";
import { useGroupStore } from "./stores/groupStore";
import { supabase } from "./lib/supabase";
import { useSessionStore } from "./stores/sessionStore";
import { useStockStore } from "./stores/stockStore";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingOutlined } from "@ant-design/icons";
import type { ReactElement } from "react";

interface NavigationItem {
  label: string | ReactElement;
  path: string;
  testId: string;
  badgeCount?: number;
}

export const ComprasWebShell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const userId = useAuthStore((state) => state.userId);
  const stockItems = useStockStore((state) => state.items);
  const ready = useSessionStore((state) => state.ready);
  const { appTitle } = useAppMode();

  // Sincroniza subdomínio (meuestoque ↔ nossoestoque) e document.title
  useSubdomainSync();

  const lowStockCount = stockItems.filter(
    (item) => item.quantidade <= item.quantidade_minima,
  ).length;
  const outOfStockCount = stockItems.filter((item) => item.quantidade === 0).length;
  const stockWarningCount = lowStockCount + outOfStockCount;

  const listId = useGroupStore((state) => state.listId);
  const [inListCount, setInListCount] = useState(0);
  const listBadgeCount = listId ? inListCount : 0;

  useEffect(() => {
    if (!listId) {
      return;
    }

    const fetchCount = async () => {
      const { count } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId)
        .eq("comprado", false);
      setInListCount(count ?? 0);
    };

    void fetchCount();

    const channel = supabase
      .channel(`shell-list-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "items", filter: `list_id=eq.${listId}` },
        () => {
          void fetchCount();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [listId]);

  const navigationItems: NavigationItem[] = [
    { label: "Lista", path: "/list", testId: "nav-list", badgeCount: listBadgeCount },
    {
      label: "Estoque",
      path: "/stock",
      testId: "nav-stock",
      badgeCount: stockWarningCount,
    },
    { label: <SettingOutlined style={{ fontSize: '1.25rem' }} />, path: "/profile", testId: "nav-config" },
  ];

  const showPrivateActions = ready && Boolean(userId);
  const activePath = location.pathname;

  return (
    <div className="min-h-screen bg-base-200 flex flex-col pb-20">
      <Navbar title={appTitle} />

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />
          <Route
            path="/group"
            element={
              <RequireAuth>
                <GroupPage />
              </RequireAuth>
            }
          />
          <Route
            path="/list"
            element={
              <RequireAuth>
                <RequireGroup>
                  <ListPageNew />
                </RequireGroup>
              </RequireAuth>
            }
          />
          <Route
            path="/history"
            element={
              <RequireAuth>
                <RequireGroup>
                  <HistoryPage />
                </RequireGroup>
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/stock"
            element={
              <RequireAuth>
                <RequireGroup>
                  <StockPageNew />
                </RequireGroup>
              </RequireAuth>
            }
          />
          <Route
            path="/stock/item/:itemId"
            element={
              <RequireAuth>
                <RequireGroup>
                  <StockItemDetailsPage />
                </RequireGroup>
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />

      {showPrivateActions && (
        <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex z-30">
          {navigationItems.map((item) => {
            const isActive = activePath === item.path || activePath.startsWith(`${item.path}/`);

            return (
              <Button
                key={item.path}
                type="button"
                variant="ghost"
                className={`relative flex-1 rounded-none h-16 flex-col gap-1 ${isActive ? "text-primary bg-primary/10 font-semibold" : "text-base-content/60"}`}
                onClick={() => navigate(item.path)}
                data-testid={item.testId}
              >
                {isActive && (
                  <span className="absolute left-3 right-3 top-1 h-1 rounded-full bg-primary" />
                )}
                <span className="text-xs uppercase tracking-wide">{item.label}</span>
                {item.badgeCount !== undefined && item.badgeCount > 0 && (
                  <span className="badge badge-sm badge-warning">{item.badgeCount}</span>
                )}
              </Button>
            );
          })}
        </nav>
      )}
    </div>
  );
};
