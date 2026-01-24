import type { ReactElement } from "react";

interface ToolItemProps {
  icon: string;
  name: string;
  version: string;
}

/**
 * Item de ferramenta com ícone, nome e versão
 *
 * @param icon - Emoji do ícone
 * @param name - Nome da ferramenta
 * @param version - Versão da ferramenta
 */
export const ToolItem = ({
  icon,
  name,
  version,
}: ToolItemProps): ReactElement => {
  return (
    <div className="flex items-center gap-3 p-4 bg-base-100 rounded-lg">
      <span className="text-2xl" aria-hidden="true">
        {icon}
      </span>
      <div>
        <p className="font-semibold">{name}</p>
        <p className="text-sm opacity-75">v{version}</p>
      </div>
    </div>
  );
};
