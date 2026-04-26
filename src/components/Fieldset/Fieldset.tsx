import type { FieldsetHTMLAttributes, ReactElement, ReactNode } from "react";

interface FieldsetProps extends FieldsetHTMLAttributes<HTMLFieldSetElement> {
  legend?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * Fieldset component for grouping related form fields.
 * 
 * Uses daisyUI styles to provide a clean visual container with an optional legend.
 *
 * @param props.legend - Title for the field group
 * @param props.description - Optional helper text displayed below the legend
 * @param props.children - Form elements to be grouped
 * @param props.className - Additional CSS classes
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
