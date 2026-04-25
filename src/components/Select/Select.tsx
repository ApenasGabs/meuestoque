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
 * Componente de select com variantes e validação, seguindo o padrão do Input
 *
 * @param variant - Variante do select
 * @param size - Tamanho do select
 * @param label - Label do select
 * @param error - Mensagem de erro
 * @param helperText - Texto auxiliar
 * @param options - Opções do select (alternativa a children)
 * @param children - Opções como children (alternativa a prop options)
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
