import type { ReactElement } from "react";
import { AppBottomNav } from "../AppBottomNav/AppBottomNav";
import { AppHeader } from "../AppHeader/AppHeader";
import { useInventoryApp } from "../../hooks/useInventoryApp";

export const InventoryApp = (): ReactElement => {
  const { activeTab, setActiveTab, syncStatus, pendingCount, activePage } = useInventoryApp();

  return (
    <div className="bg-base-200 min-h-screen">
      <div className="w-full bg-base-100 min-h-screen flex flex-col relative">
        <AppHeader activeTab={activeTab} syncStatus={syncStatus} />
        <main className="flex-1 overflow-hidden flex flex-col">{activePage}</main>
        <AppBottomNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          pendingCount={pendingCount}
        />
      </div>
    </div>
  );
};
