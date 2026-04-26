import type { ReactElement, ReactNode } from "react";

interface RadioProps extends Omit<
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
 * Radio button component with integrated label and visual variants.
 * 
 * Uses daisyUI radio styles for consistent appearance.
 *
 * @param props.label - Text or element to display alongside the radio button
 * @param props.size - Size variant of the radio button
 * @param props.color - Semantic color variant of the radio button
 */
export const Radio = ({
  label,
  size = "md",
  color = "primary",
  className = "",
  ...props
}: RadioProps): ReactElement => {
  const sizeClasses: Record<string, string> = {
    sm: "radio-sm",
    md: "",
    lg: "radio-lg",
  };

  const colorClasses: Record<string, string> = {
    primary: "radio-primary",
    secondary: "radio-secondary",
    accent: "radio-accent",
    success: "radio-success",
    warning: "radio-warning",
    error: "radio-error",
    info: "radio-info",
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const colorClass = colorClasses[color] || colorClasses.primary;

  return (
    <label className="label cursor-pointer">
      <input
        type="radio"
        className={`radio ${colorClass} ${sizeClass} ${className}`.trim()}
        {...props}
      />
      {label && <span className="label-text">{label}</span>}
    </label>
  );
};
