import type { ReactElement } from "react";

interface InputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  variant?: "bordered" | "filled" | "faded";
  size?: "sm" | "md" | "lg";
  label?: string;
  error?: string;
  helperText?: string;
}

/**
 * Versatile input component with multiple variants and validation support.
 * 
 * Includes integrated labels, error messages, and helper texts using daisyUI styles.
 *
 * @param props.variant - Visual style variant (bordered, filled, faded)
 * @param props.size - Size variant of the input
 * @param props.label - Optional label text displayed above the input
 * @param props.error - Error message to display below the input (changes border color to error)
 * @param props.helperText - Supplemental text to display when there's no error
 */
export const Input = ({
  variant = "bordered",
  size = "md",
  label,
  error,
  helperText,
  className = "",
  ...props
}: InputProps): ReactElement => {
  const variantClasses: Record<string, string> = {
    bordered: "input-bordered",
    filled: "input-filled",
    faded: "input-faded",
  };

  const sizeClasses: Record<string, string> = {
    sm: "input-sm",
    md: "",
    lg: "input-lg",
  };

  const variantClass = variantClasses[variant] || variantClasses.bordered;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const hasError = error ? "input-error" : "";
  const hasWidth = className.includes("w-") || (props.style && props.style.width);
  const isFullWidth = (label || !hasWidth);

  return (
    <div className={isFullWidth ? "w-full" : ""}>
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <input
        className={`input ${isFullWidth ? "w-full" : ""} ${variantClass} ${sizeClass} ${hasError} ${className}`.trim()}
        {...props}
      />
      {error && (
        <label className="label">
          <span className="label-text-alt text-error">{error}</span>
        </label>
      )}
      {helperText && !error && (
        <label className="label">
          <span className="label-text-alt">{helperText}</span>
        </label>
      )}
    </div>
  );
};
