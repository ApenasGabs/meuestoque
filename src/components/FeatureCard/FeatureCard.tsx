import type { ReactElement } from "react";

interface FeatureCardProps {
  title: string;
  description: string;
  version: string;
  href: string;
  variant: "primary" | "secondary" | "accent";
  testId?: string;
}

/**
 * Promotional card component for highlighting a feature or library.
 * 
 * Includes an external link and visual variant support.
 *
 * @param props.title - Feature name or title
 * @param props.description - Short summary of the feature
 * @param props.version - Version number of the technology
 * @param props.href - Destination URL for the external link
 * @param props.variant - Semantic color variant for the background
 * @param props.testId - Testing identifier
 */
export const FeatureCard = ({
  title,
  description,
  version,
  href,
  variant,
  testId,
}: FeatureCardProps): ReactElement => {
  const variantStyles: Record<string, string> = {
    primary: "bg-primary text-primary-content",
    secondary: "bg-secondary text-secondary-content",
    accent: "bg-accent text-accent-content",
  };

  const colorClass = variantStyles[variant] || variantStyles.primary;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`rounded-lg border-2 border-current p-6 ${colorClass} hover:shadow-lg transition-shadow cursor-pointer`}
      data-testid={testId}
    >
      <div className="flex flex-col items-center justify-center text-center">
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <p className="mb-3">{description}</p>
        <div className="border-t border-current my-2 w-full"></div>
        <p className="text-sm opacity-90">v{version}</p>
      </div>
    </a>
  );
};
