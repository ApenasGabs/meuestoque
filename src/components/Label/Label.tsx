import type { LabelHTMLAttributes, ReactElement, ReactNode } from "react";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  required?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
}

/**
 * Label component for form inputs.
 * 
 * Provides consistent typography and optional "required" indicator.
 *
 * @param props.children - Label text or content
 * @param props.required - If true, displays a semantic asterisk
 * @param props.disabled - If true, reduces opacity and changes cursor
 * @param props.size - Text size variant
 */
export const Label = ({
  children,
  required = false,
  disabled = false,
  size = "md",
  className = "",
  ...props
}: LabelProps): ReactElement => {
  const sizeClasses: Record<string, string> = {
    sm: "text-xs",
    md: "text-sm",
    lg: "text-base",
  };

  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const disabledClass = disabled ? "opacity-50 cursor-not-allowed" : "";

  return (
    <label
      className={`font-medium text-base-content ${sizeClass} ${disabledClass} ${className}`.trim()}
      {...props}
    >
      {children}
      {required && <span className="text-error ml-1">*</span>}
    </label>
  );
};
