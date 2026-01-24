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
 * Card de feature com link externo
 *
 * @param title - Título da feature
 * @param description - Descrição da feature
 * @param version - Versão da tecnologia
 * @param href - URL de destino
 * @param variant - Variante de cor do card
 * @param testId - ID para testes
 */
export const FeatureCard = ({
  title,
  description,
  version,
  href,
  variant,
  testId,
}: FeatureCardProps): ReactElement => {
  const colorClass = `bg-${variant} text-${variant}-content`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`card ${colorClass} hover:shadow-lg transition-shadow`}
      data-testid={testId}
    >
      <div className="card-body items-center text-center">
        <h2 className="card-title">{title}</h2>
        <p>{description}</p>
        <div className="divider my-2"></div>
        <p className="text-sm opacity-90">v{version}</p>
      </div>
    </a>
  );
};
