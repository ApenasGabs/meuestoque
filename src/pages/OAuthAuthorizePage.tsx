import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Alert } from "../components/Alert/Alert";
import { Button } from "../components/Button/Button";
import { Card, CardBody } from "../components/Card/Card";
import {
  buildRedirectUrl,
  requestOAuthCode,
  validateAuthorizeParams,
  type OAuthAuthorizeParams,
} from "../lib/mcpOAuth";
import { useAuthStore } from "../stores/authStore";
import { useSessionStore } from "../stores/sessionStore";

export const OAuthAuthorizePage = (): ReactElement => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const ready = useSessionStore((state) => state.ready);
  const userId = useAuthStore((state) => state.userId);
  const userName = useAuthStore((state) => state.userName);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectTarget, setRedirectTarget] = useState<string | null>(null);

  useEffect(() => {
    if (redirectTarget) {
      window.location.assign(redirectTarget);
    }
  }, [redirectTarget]);

  const params: OAuthAuthorizeParams = {
    responseType: searchParams.get("response_type"),
    clientId: searchParams.get("client_id"),
    redirectUri: searchParams.get("redirect_uri"),
    codeChallenge: searchParams.get("code_challenge"),
    codeChallengeMethod: searchParams.get("code_challenge_method"),
    state: searchParams.get("state"),
    scope: searchParams.get("scope"),
  };

  if (!ready) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]" data-testid="oauth-loading">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md" data-testid="oauth-unauthenticated">
        <Card className="bg-base-100 shadow-xl border border-base-200">
          <CardBody className="space-y-4 text-center">
            <h2 className="text-xl font-bold">Autenticação necessária</h2>
            <p className="text-sm text-base-content/70">
              Você precisa entrar na sua conta do MeuEstoque para autorizar o acesso de ferramentas externas.
            </p>
            <Link
              to="/login"
              state={{ from: location }}
              className="btn btn-primary w-full"
              data-testid="oauth-login-link"
            >
              Fazer login no MeuEstoque
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const validation = validateAuthorizeParams(params);
  if (!validation.valid) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md" data-testid="oauth-invalid-params">
        <Card className="bg-base-100 shadow-xl border border-error/20">
          <CardBody className="space-y-4">
            <h2 className="text-lg font-bold text-error">Parâmetros de autorização inválidos</h2>
            <Alert type="error">{validation.errorDescription}</Alert>
            <p className="text-xs text-base-content/60">
              Código do erro: <code className="font-mono">{validation.error}</code>
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const clientName = params.clientId || "Claude.ai";
  const scopesList = params.scope ? params.scope.split(/\s+/).filter(Boolean) : ["read", "write"];

  const handleAuthorize = async (): Promise<void> => {
    setError(null);
    setSubmitting(true);
    try {
      const code = await requestOAuthCode({
        clientId: params.clientId ?? "",
        codeChallenge: params.codeChallenge ?? "",
        redirectUri: params.redirectUri ?? "",
        scopes: scopesList,
      });

      const redirectParams: Record<string, string> = { code };
      if (params.state) {
        redirectParams.state = params.state;
      }

      const destination = buildRedirectUrl(params.redirectUri ?? "", redirectParams);
      setRedirectTarget(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao gerar autorização");
      setSubmitting(false);
    }
  };

  const handleDeny = (): void => {
    if (!params.redirectUri) return;
    const redirectParams: Record<string, string> = {
      error: "access_denied",
      error_description: "O usuário recusou a solicitação de autorização",
    };
    if (params.state) {
      redirectParams.state = params.state;
    }
    setRedirectTarget(buildRedirectUrl(params.redirectUri, redirectParams));
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-lg" data-testid="oauth-authorize-page">
      <Card className="bg-base-100 shadow-xl border border-base-200">
        <CardBody className="space-y-5">
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-2">
              <span className="text-4xl">🔐</span>
            </div>
            <h1 className="text-2xl font-bold" data-testid="oauth-client-name">
              Conectar com {clientName}
            </h1>
            <p className="text-sm text-base-content/70">
              Uma aplicação externa está solicitando permissão para acessar sua conta.
            </p>
          </div>

          <div className="bg-base-200 p-3 rounded-lg text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-base-content/70">Conectando como:</span>
              <strong className="text-base-content" data-testid="oauth-user-email">
                {userName || userId}
              </strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-base-content/70">Cliente:</span>
              <span className="font-mono truncate max-w-[240px]">{clientName}</span>
            </div>
          </div>

          {error && <Alert type="error">{error}</Alert>}

          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-base-content/60">
              Permissões solicitadas
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2 bg-base-200/50 p-2 rounded">
                <span className="text-lg">👁️</span>
                <div>
                  <strong>Leitura de estoque e compras</strong>
                  <p className="text-xs text-base-content/70">
                    Consultar itens, quantidades, listas e histórico.
                  </p>
                </div>
              </li>
              {scopesList.includes("write") && (
                <li className="flex items-start gap-2 bg-base-200/50 p-2 rounded">
                  <span className="text-lg">✏️</span>
                  <div>
                    <strong>Gerenciamento de estoque e compras</strong>
                    <p className="text-xs text-base-content/70">
                      Adicionar, editar e consumir produtos em seu nome.
                    </p>
                  </div>
                </li>
              )}
            </ul>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <Button
              type="button"
              variant="primary"
              className="flex-1"
              disabled={submitting}
              onClick={() => void handleAuthorize()}
              data-testid="oauth-authorize-button"
            >
              {submitting ? "Autorizando..." : "Autorizar acesso"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="flex-1"
              disabled={submitting}
              onClick={handleDeny}
              data-testid="oauth-deny-button"
            >
              Cancelar
            </Button>
          </div>

          <p className="text-center text-xs text-base-content/50">
            Você poderá revogar este acesso a qualquer momento nas configurações do seu Perfil.
          </p>
        </CardBody>
      </Card>
    </div>
  );
};
