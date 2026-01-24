import type { ReactElement } from "react";

interface LogoProps {
  src: string;
  alt: string;
  href: string;
  testId?: string;
  animated?: boolean;
}

/**
 * Componente de logo com link externo
 *
 * @param src - URL da imagem do logo
 * @param alt - Texto alternativo para acessibilidade
 * @param href - URL de destino do link
 * @param testId - ID para testes
 * @param animated - Se deve aplicar animação de rotação
 */
export const Logo = ({
  src,
  alt,
  href,
  testId,
  animated = false,
}: LogoProps): ReactElement => {
  const animationClass = animated ? "animate-spin-slow" : "";

  return (
    <a href={href} target="_blank" rel="noreferrer">
      <img
        src={src}
        className={`h-24 hover:drop-shadow-[0_0_2em_#646cffaa] transition-all ${animationClass}`.trim()}
        alt={alt}
        data-testid={testId}
      />
    </a>
  );
};
