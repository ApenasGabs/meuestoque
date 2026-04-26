import type { ReactElement, ReactNode } from "react";

interface DividerProps {
  children?: ReactNode;
  variant?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Visual separator component with optional text and orientation.
 * 
 * @param props.children - Optional text to display in the middle of the divider
 * @param props.variant - Layout orientation (horizontal or vertical)
 * @param props.className - Additional CSS classes
 */
export const Divider = ({
  children,
  variant = "horizontal",
  className = "",
}: DividerProps): ReactElement => {
  if (variant === "vertical") {
    return (
      <div
        className={`h-16 w-px bg-base-300 ${className}`.trim()}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (children) {
    return (
      <div
        className={`flex items-center gap-4 my-6 ${className}`.trim()}
        role="separator"
      >
        <div className="flex-1 h-px bg-base-300"></div>
        <span className="text-sm text-base-content/60 font-medium">
          {children}
        </span>
        <div className="flex-1 h-px bg-base-300"></div>
      </div>
    );
  }

  return (
    <div
      className={`h-px w-full bg-base-300 my-6 ${className}`.trim()}
      role="separator"
      aria-orientation="horizontal"
    />
  );
};
