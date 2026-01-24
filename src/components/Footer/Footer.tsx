import type { ReactElement } from "react";
import { ExternalLink } from "../ExternalLink/ExternalLink";

/**
 * Componente de rodapé da aplicação
 */
export const Footer = (): ReactElement => {
  return (
    <footer className="footer footer-center p-4 bg-base-300 text-base-content">
      <aside>
        <p>Template React + TypeScript + Vite + Tailwind CSS + daisyUI</p>
        <p className="text-sm opacity-75">
          Feito com muito ❤️ e preguiça de fazer tudo do zero por{" "}
          <ExternalLink href="https://github.com/apenasgabs">
            ApenasGabs
          </ExternalLink>
        </p>
      </aside>
    </footer>
  );
};
