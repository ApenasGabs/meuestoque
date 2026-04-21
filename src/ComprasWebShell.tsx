import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Button } from "./components/Button/Button";
import { Footer } from "./components/Footer/Footer";
import { Navbar } from "./components/Navbar/Navbar";
import { PublicOnly, RequireAuth, RequireGroup } from "./components/RouteGuards";
import ThemeSelector from "./components/ThemeSelector/ThemeSelector";
import { supabase } from "./lib/supabase";
import { GroupPage } from "./pages/GroupPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ListPage } from "./pages/ListPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ProfilePage } from "./pages/ProfilePage";
import { RegisterPage } from "./pages/RegisterPage";
import { StockItemDetailsPage } from "./pages/StockItemDetailsPage";
import { StockPage } from "./pages/StockPage";
import { useAuthStore } from "./stores/authStore";
import { useGroupStore } from "./stores/groupStore";
import { useSessionStore } from "./stores/sessionStore";
import { useStockStore } from "./stores/stockStore";

export const ComprasWebShell = () => {
  const navigate = useNavigate();
  const userId = useAuthStore((state) => state.userId);
  const userName = useAuthStore((state) => state.userName);
  const clearUser = useAuthStore((state) => state.clearUser);
  const groupName = useGroupStore((state) => state.groupName);
  const clearAllGroupState = useGroupStore((state) => state.clearAllGroupState);
  const clearStock = useStockStore((state) => state.clearStock);
  const ready = useSessionStore((state) => state.ready);

  const handleLogout = async (): Promise<void> => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Falha ao sair da conta", error);
      return;
    }

    clearUser();
    clearAllGroupState();
    clearStock();
    navigate("/login", { replace: true });
  };

  const showPrivateActions = ready && Boolean(userId);

  return (
    <div className="min-h-screen bg-base-200 flex flex-col">
      <Navbar title="Compras em Dois">
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {showPrivateActions && (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/group")}>
                Grupo
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/list")}>
                Lista
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/history")}>
                Histórico
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/stock")}>
                Estoque
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
                Perfil
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout}>
                Sair
              </Button>
            </>
          )}
          <div className="ml-2 flex items-center gap-2">
            <span className="hidden sm:inline text-sm text-base-content/70">
              {groupName ? `Grupo: ${groupName}` : (userName ?? "Visitante")}
            </span>
            <ThemeSelector />
          </div>
        </div>
      </Navbar>

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
                  <ListPage />
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
                  <StockPage />
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
    </div>
  );
};
