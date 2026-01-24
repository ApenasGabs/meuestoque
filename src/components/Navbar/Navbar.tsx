import type { ReactElement, ReactNode } from "react";

interface NavbarProps {
  title: string;
  children?: ReactNode;
}

/**
 * Componente de barra de navegação
 *
 * @param title - Título exibido na navbar
 * @param children - Elementos adicionais (ex: seletor de tema)
 */
export const Navbar = ({ title, children }: NavbarProps): ReactElement => {
  return (
    <div className="navbar bg-base-100 shadow-lg">
      <div className="flex-1">
        <a className="btn btn-ghost text-xl" data-testid="navbar-title">
          {title}
        </a>
      </div>
      <div className="flex-none gap-4">{children}</div>
    </div>
  );
};
