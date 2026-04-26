import type { ReactElement, ReactNode } from "react";

interface CheckboxProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  label?: ReactNode;
  size?: "sm" | "md" | "lg";
  color?:
    | "primary"
    | "secondary"
    | "accent"
    | "success"
    | "warning"
    | "error"
    | "info";
}

/**
 * Checkbox component with integrated label and multiple color/size variants.
 * 
 * Uses daisyUI checkbox styles.
 * 
 * @param props.label - Text or element to display alongside the checkbox
 * @param props.size - Size variant of the checkbox
 * @param props.color - Semantic color variant of the checkbox
 */
export const Checkbox = ({
  label,
  size = "md",
  color = "primary",
  className = "",
  ...props
}: CheckboxProps): ReactElement => {
  const sizeClasses: Record<string, string> = {
    sm: "checkbox-sm",
    md: "",
    lg: "checkbox-lg",
  };

  const colorClasses: Record<string, string> = {
    primary: "checkbox-primary",
    secondary: "checkbox-secondary",
    accent: "checkbox-accent",
    success: "checkbox-success",
    warning: "checkbox-warning",
    error: "checkbox-error",
    info: "checkbox-info",
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const colorClass = colorClasses[color] || colorClasses.primary;

  return (
    <label className="label cursor-pointer">
      <input
        type="checkbox"
        className={`checkbox ${colorClass} ${sizeClass} ${className}`.trim()}
        {...props}
      />
      {label && <span className="label-text">{label}</span>}
    </label>
  );
};
