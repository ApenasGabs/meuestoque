import type { ReactElement } from "react";
import { ExternalLink } from "../ExternalLink/ExternalLink";

/**
 * Componente de rodapé da aplicação
 */
export const Footer = (): ReactElement => {
  return (
    <footer className="footer bg-base-300 text-base-content py-6 px-4 border-t border-base-300 mb-0">
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center text-center space-y-2">
        <p className="text-xs text-base-content/60">
          Feito com muito ❤️por{" "}
          <ExternalLink href="https://github.com/apenasgabs">ApenasGabs</ExternalLink>
        </p>
      </div>
    </footer>
  );
};
