import type { HTMLAttributes, ReactElement, ReactNode } from "react";

interface DockProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Componente de dock (bottom navigation) seguindo o padrão daisyUI
 *
 * @param children - Itens de navegação (DockItem)
 * @param className - Classes CSS adicionais
 * @param testId - ID para testes
 */
export const Dock = ({
  children,
  className = "",
  testId,
  ...props
}: DockProps): ReactElement => {
  return (
    <nav
      className={`dock fixed bottom-0 left-0 right-0 z-30 ${className}`.trim()}
      data-testid={testId}
      {...props}
    >
      {children}
    </nav>
  );
};

interface DockItemProps {
  label: string | ReactElement;
  active?: boolean;
  badgeCount?: number;
  onClick?: () => void;
  className?: string;
  testId?: string;
}

/**
 * Item individual do dock
 *
 * @param label - Texto ou ícone do item
 * @param active - Se este item está ativo
 * @param badgeCount - Contagem para exibir no badge
 * @param onClick - Callback ao clicar
 * @param testId - ID para testes
 */
export const DockItem = ({
  label,
  active = false,
  badgeCount,
  onClick,
  className = "",
  testId,
}: DockItemProps): ReactElement => {
  return (
    <button
      type="button"
      className={`dock-label ${active ? "dock-active" : ""} ${className}`.trim()}
      onClick={onClick}
      data-testid={testId}
    >
      <span className="text-xs uppercase tracking-wide">{label}</span>
      {badgeCount !== undefined && badgeCount > 0 && (
        <span className="badge badge-sm badge-warning">{badgeCount}</span>
      )}
    </button>
  );
};
