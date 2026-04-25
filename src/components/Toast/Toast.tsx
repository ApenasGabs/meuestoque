import { useEffect, type ReactElement, type ReactNode } from "react";

type ToastPosition =
  | "toast-top toast-end"
  | "toast-top toast-start"
  | "toast-top toast-center"
  | "toast-bottom toast-end"
  | "toast-bottom toast-start"
  | "toast-bottom toast-center";

interface ToastProps {
  children: ReactNode;
  type?: "info" | "success" | "warning" | "error";
  position?: ToastPosition;
  visible: boolean;
  onDismiss?: () => void;
  autoDismissMs?: number;
  testId?: string;
}

/**
 * Componente de toast usando o padrão daisyUI com auto-dismiss
 *
 * @param children - Conteúdo do toast
 * @param type - Tipo visual do toast (info, success, warning, error)
 * @param position - Posição do toast na tela
 * @param visible - Se o toast deve estar visível
 * @param onDismiss - Callback ao dismissar o toast
 * @param autoDismissMs - Tempo em ms para auto-dismiss (padrão: 2500)
 * @param testId - ID para testes
 */
export const Toast = ({
  children,
  type = "success",
  position = "toast-top toast-end",
  visible,
  onDismiss,
  autoDismissMs = 2500,
  testId,
}: ToastProps): ReactElement | null => {
  useEffect(() => {
    if (!visible || !onDismiss || autoDismissMs <= 0) return;

    const timeoutId = window.setTimeout(() => {
      onDismiss();
    }, autoDismissMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoDismissMs, onDismiss, visible]);

  if (!visible) {
    return null;
  }

  const typeClasses: Record<string, string> = {
    info: "alert-info",
    success: "alert-success",
    warning: "alert-warning",
    error: "alert-error",
  };

  const typeClass = typeClasses[type] || typeClasses.success;

  return (
    <div className={`toast ${position} z-50`} data-testid={testId}>
      <div className={`alert ${typeClass}`}>
        <span>{children}</span>
      </div>
    </div>
  );
};
