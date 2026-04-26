import type { ButtonHTMLAttributes, ReactElement } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "accent" | "ghost";
  size?: "sm" | "md" | "lg";
}

/**
 * Versatile button component with variant and size support.
 * 
 * Uses daisyUI button styles for consistent appearance.
 *
 * @param props.variant - Visual style variant (primary, secondary, accent, or ghost)
 * @param props.size - Size variant of the button
 * @param props.children - Button label or content
 * @param props.className - Additional CSS classes
 */
export const Button = ({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...props
}: ButtonProps): ReactElement => {
  const sizeClasses: Record<string, string> = {
    sm: "btn-sm",
    md: "",
    lg: "btn-lg",
  };

  const variantClasses: Record<string, string> = {
    primary: "btn-primary",
    secondary: "btn-secondary",
    accent: "btn-accent",
    ghost: "btn-ghost",
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const variantClass = variantClasses[variant] || variantClasses.primary;

  return (
    <button
      className={`btn ${variantClass} ${sizeClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
};
