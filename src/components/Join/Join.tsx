import type { HTMLAttributes, ReactElement, ReactNode } from "react";

interface JoinProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  direction?: "horizontal" | "vertical";
  className?: string;
}

/**
 * Componente Join para agrupar itens (botões, inputs, etc) com bordas compartilhadas
 *
 * @param children - Itens a serem agrupados (devem ter classe "join-item")
 * @param direction - Direção do agrupamento (horizontal ou vertical)
 * @param className - Classes CSS adicionais
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
