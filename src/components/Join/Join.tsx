import type { HTMLAttributes, ReactElement, ReactNode } from "react";

interface JoinProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Join component for grouping multiple items (buttons, inputs, etc.) with shared borders.
 * 
 * Uses daisyUI join patterns. Child items should typically have the "join-item" class.
 *
 * @param props.children - Items to be grouped together
 * @param props.direction - Layout direction (horizontal or vertical)
 * @param props.className - Additional CSS classes
 */
export const Join = ({
  children,
  direction = "horizontal",
  className = "",
  ...props
}: JoinProps): ReactElement => {
  const directionClass = direction === "vertical" ? "join-vertical" : "join-horizontal";

  return (
    <div
      className={`join ${directionClass} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
};
