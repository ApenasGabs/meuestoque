import type { FieldsetHTMLAttributes, ReactElement, ReactNode } from "react";

interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Componente de fieldset usando o padrão daisyUI para agrupar campos de formulário
 *
 * @param legend - Título do grupo de campos
 * @param description - Descrição auxiliar do grupo
 * @param children - Campos de formulário do grupo
 * @param className - Classes CSS adicionais
 */
export const Fieldset = ({
  legend,
  description,
  children,
  className = "",
  ...props
}: FieldsetProps): ReactElement => {
  return (
    <fieldset
      className={`fieldset rounded-box border border-base-300 bg-base-200 p-4 ${className}`.trim()}
      {...props}
    >
      {legend && (
        <legend className="fieldset-legend font-semibold text-sm px-2">
          {legend}
        </legend>
      )}
      {description && (
        <p className="text-xs text-base-content/60 mb-3">{description}</p>
      )}
      <div className="space-y-3">{children}</div>
    </fieldset>
  );
};
