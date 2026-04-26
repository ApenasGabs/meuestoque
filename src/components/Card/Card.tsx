import type { HTMLAttributes, ReactElement, ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Basic layout card component.
 * 
 * Provides a consistent container with border and shadow.
 *
 * @param props.children - Card content
 * @param props.className - Additional CSS classes
 * @param props.testId - Testing identifier
 */
export const Card = ({ children, className = "", testId }: CardProps): ReactElement => {
  return (
    <div
      className={`rounded-lg border border-base-300 bg-base-100 shadow-lg ${className}`.trim()}
      data-testid={testId}
    >
      {children}
    </div>
  );
};

interface CardBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  centered?: boolean;
  className?: string;
}

/**
 * Main content container for the Card component.
 * 
 * Includes padding and optional centering logic.
 *
 * @param props.children - Body content
 * @param props.centered - If true, centers content vertically and horizontally
 * @param props.className - Additional CSS classes
 */
export const CardBody = ({
  children,
  centered = false,
  className = "",
  ...props
}: CardBodyProps): ReactElement => {
  const centerClass = centered ? "flex flex-col items-center justify-center text-center" : "";

  return (
    <div className={`p-6 ${centerClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

/**
 * Formatted title for the Card component.
 * 
 * @param props.children - Title text or content
 * @param props.className - Additional CSS classes
 */
export const CardTitle = ({ children, className = "" }: CardTitleProps): ReactElement => {
  return <h2 className={`text-2xl font-bold mb-4 ${className}`.trim()}>{children}</h2>;
};
