import type { ReactElement } from "react";
import { Badge } from "../Badge/Badge";
import type { SyncStatus, TabKey } from "../../types/inventory";
import { useAppMode } from "../../hooks/useAppMode";

interface SyncConfig {
  label: string;
  variant: "success" | "warning" | "error" | "info";
}

interface AppHeaderProps {
  activeTab: TabKey;
  syncStatus: SyncStatus;
}

const SyncBadge = ({ status }: { status: SyncStatus }): ReactElement => {
  const configs: Record<SyncStatus, SyncConfig> = {
    synced: { label: "Sincronizado", variant: "success" },
    syncing: { label: "Sincronizando", variant: "warning" },
    offline: { label: "Offline", variant: "info" },
    error: { label: "Erro de sync", variant: "error" },
  };

  const config = configs[status];

  return (
    <Badge variant={config.variant} size="sm" className="font-mono tracking-wide uppercase">
      {config.label}
    </Badge>
  );
};

export const AppHeader = ({ activeTab, syncStatus }: AppHeaderProps): ReactElement => {
  const { appTitle } = useAppMode();

  const titles: Record<TabKey, string> = {
    lista: "Lista de Compras",
    pendentes: "Pendentes",
    estoque: "Estoque",
  };

  return (
    <header className="bg-base-100 border-b border-base-300 px-4 py-3 flex items-center justify-between sticky top-0 z-30">
      <div className="leading-tight">
        <p className="text-[11px] uppercase tracking-[0.16em] text-primary font-semibold">
          {appTitle}
        </p>
        <h1 className="text-base font-semibold tracking-tight">{titles[activeTab]}</h1>
      </div>
      <SyncBadge status={syncStatus} />
    </header>
  );
};

