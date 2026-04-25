import type { HTMLAttributes, ReactElement } from "react";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: "text" | "circle" | "rect";
  width?: string;
  height?: string;
  lines?: number;
  className?: string;
}

/**
 * Componente de skeleton para estados de loading
 *
 * @param variant - Formato do skeleton (text, circle, rect)
 * @param width - Largura customizada
 * @param height - Altura customizada
 * @param lines - Número de linhas de texto (apenas para variant=text)
 * @param className - Classes CSS adicionais
 */
export const Skeleton = ({
  variant = "text",
  width,
  height,
  lines = 1,
  className = "",
  ...props
}: SkeletonProps): ReactElement => {
  const style = {
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  };

  if (variant === "circle") {
    return (
      <div
        className={`skeleton rounded-full ${className}`.trim()}
        style={{ width: width ?? "3rem", height: height ?? "3rem", ...style }}
        {...props}
      />
    );
  }

  if (variant === "rect") {
    return (
      <div
        className={`skeleton ${className}`.trim()}
        style={{ width: width ?? "100%", height: height ?? "8rem", ...style }}
        {...props}
      />
    );
  }

  // variant === "text"
  if (lines === 1) {
    return (
      <div
        className={`skeleton h-4 ${className}`.trim()}
        style={style}
        {...props}
      />
    );
  }

  return (
    <div className={`space-y-2 ${className}`.trim()} {...props}>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className="skeleton h-4"
          style={index === lines - 1 ? { width: "75%" } : undefined}
        />
      ))}
    </div>
  );
};

interface SkeletonCardProps {
  className?: string;
}

/**
 * Skeleton pré-formatado no formato de card de produto/item
 */
export const SkeletonCard = ({
  className = "",
}: SkeletonCardProps): ReactElement => {
  return (
    <div
      className={`rounded-lg border border-base-300 bg-base-100 p-4 space-y-3 ${className}`.trim()}
    >
      <div className="flex items-center gap-3">
        <Skeleton variant="circle" width="2.5rem" height="2.5rem" />
        <div className="flex-1 space-y-2">
          <Skeleton width="60%" />
          <Skeleton width="40%" />
        </div>
      </div>
    </div>
  );
};
