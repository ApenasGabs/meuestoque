import type { ReactElement } from "react";
import { Badge } from "../Badge/Badge";
import { Button } from "../Button/Button";
import type { TabKey } from "../../types/inventory";

interface AppBottomNavProps {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  pendingCount: number;
}

export const AppBottomNav = ({
  activeTab,
  setActiveTab,
  pendingCount,
}: AppBottomNavProps): ReactElement => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-base-100 border-t border-base-300 flex z-30">
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "lista" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("lista")}
        data-testid="tab-lista"
      >
        Lista
      </Button>
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "pendentes" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("pendentes")}
        data-testid="tab-pendentes"
      >
        Pendentes
        {pendingCount > 0 && (
          <Badge variant="warning" size="sm" className="ml-2">
            {pendingCount}
          </Badge>
        )}
      </Button>
      <Button
        variant="ghost"
        className={`flex-1 rounded-none ${activeTab === "estoque" ? "text-primary" : "text-base-content/60"}`}
        onClick={() => setActiveTab("estoque")}
        data-testid="tab-estoque"
      >
        Estoque
      </Button>
    </nav>
  );
};
