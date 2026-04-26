import type { ReactElement, SelectHTMLAttributes } from "react";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  variant?: "bordered" | "filled" | "faded";
  size?: "sm" | "md" | "lg";
  label?: string;
  error?: string;
  helperText?: string;
  options?: Array<{ value: string; label: string }>;
}

/**
 * Form select component with variants and validation support.
 * 
 * Follows the same design pattern as the Input component using daisyUI styles.
 *
 * @param props.variant - Visual style variant of the select
 * @param props.size - Size variant of the select
 * @param props.label - Optional label text displayed above the select
 * @param props.error - Error message to display below the select
 * @param props.helperText - Supplemental text to display when there's no error
 * @param props.options - Array of options to render (alternative to children)
 * @param props.children - Option elements to render (alternative to options prop)
 */
export const Select = ({
  variant = "bordered",
  size = "md",
  label,
  error,
  helperText,
  options,
  children,
  className = "",
  ...props
}: SelectProps): ReactElement => {
  const variantClasses: Record<string, string> = {
    bordered: "select-bordered",
    filled: "select-filled",
    faded: "select-faded",
  };

  const sizeClasses: Record<string, string> = {
    sm: "select-sm",
    md: "",
    lg: "select-lg",
  };

  const variantClass = variantClasses[variant] || variantClasses.bordered;
  const sizeClass = sizeClasses[size] || sizeClasses.md;
  const hasError = error ? "select-error" : "";

  return (
    <div className="w-full">
      {label && (
        <label className="label">
          <span className="label-text">{label}</span>
        </label>
      )}
      <select
        className={`select w-full ${variantClass} ${sizeClass} ${hasError} ${className}`.trim()}
        {...props}
      >
        {options
          ? options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))
          : children}
      </select>
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
