import type { HTMLAttributes, ReactElement, ReactNode } from "react";

interface DockProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Bottom navigation dock component.
 * 
 * Provides a fixed navigation bar at the bottom of the screen, typical for mobile apps.
 *
 * @param props.children - Navigation items (typically DockItem)
 * @param props.className - Additional CSS classes
 * @param props.testId - Testing identifier
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
 * Individual navigation item for the Dock component.
 * 
 * @param props.label - Text or icon content for the item
 * @param props.active - Highlight state if this is the current route
 * @param props.badgeCount - Optional numeric badge count to display
 * @param props.onClick - Click handler for navigation
 * @param props.testId - Testing identifier
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
