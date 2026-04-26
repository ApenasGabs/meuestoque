import type { ReactElement, ReactNode } from "react";

interface BadgeProps {
  children: ReactNode;
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "accent"
    | "success"
    | "warning"
    | "error"
    | "info";
  size?: "sm" | "md" | "lg";
  className?: string;
}

/**
 * Badge component for displaying status, labels, or categories.
 * 
 * Supports various semantic colors and sizes based on daisyUI patterns.
 * 
 * @param props.children - Content to be displayed inside the badge
 * @param props.variant - Color variant of the badge
 * @param props.size - Size variant of the badge
 * @param props.className - Additional CSS classes
 */
export const Badge = ({
  children,
  variant = "default",
  size = "md",
  className = "",
}: BadgeProps): ReactElement => {
  const variantClasses: Record<string, string> = {
    default: "badge",
    primary: "badge-primary",
    secondary: "badge-secondary",
    accent: "badge-accent",
    success: "badge-success",
    warning: "badge-warning",
    error: "badge-error",
    info: "badge-info",
  };

  const sizeClasses: Record<string, string> = {
    sm: "badge-sm",
    md: "",
    lg: "badge-lg",
  };

  const variantClass = variantClasses[variant] || variantClasses.default;
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <span className={`badge ${variantClass} ${sizeClass} ${className}`.trim()}>
      {children}
    </span>
  );
};
