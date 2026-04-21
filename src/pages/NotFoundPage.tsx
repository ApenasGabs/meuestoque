import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/Button/Button";

/**
 * Exibe a página de erro 404 e oferece navegação para o login.
 *
 * @returns Página de conteúdo não encontrado
 */
export const NotFoundPage = (): ReactElement => {
  const navigate = useNavigate();

  return (
    <main className="page">
      <h1>404</h1>
      <p>Página não encontrada.</p>
      <Button variant="ghost" onClick={() => navigate("/login")}>
        Ir para login
      </Button>
    </main>
  );
};
