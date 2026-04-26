import type { ReactElement, ReactNode } from "react";

interface NavbarProps {
  title: string;
  children?: ReactNode;
}

/**
 * Top navigation bar component.
 * 
 * Displays the application title and provides a slot for additional controls 
 * such as theme selectors or user menus.
 *
 * @param props.title - The title displayed in the navbar
 * @param props.children - Additional elements to display on the right side
 */
export const Navbar = ({ title, children }: NavbarProps): ReactElement => {
  return (
    <nav className="navbar flex items-center justify-between bg-base-100 shadow-lg px-6 py-4">
      <div className="flex-1">
        <a
          className="text-xl font-bold text-base-content hover:text-primary transition-colors cursor-pointer"
          data-testid="navbar-title"
        >
          {title}
        </a>
      </div>
      <div className="flex items-center gap-4">{children}</div>
    </nav>
  );
};
