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
 * Toast notification component with optional auto-dismiss behavior.
 * 
 * Uses daisyUI toast and alert patterns for consistent styling.
 *
 * @param props.children - Content to be displayed inside the toast
 * @param props.type - Semantic type (info, success, warning, error)
 * @param props.position - Screen placement of the toast
 * @param props.visible - Controls visibility of the component
 * @param props.onDismiss - Callback executed when toast is hidden or auto-dismissed
 * @param props.autoDismissMs - Duration in ms before auto-dismiss (default: 2500, set to 0 to disable)
 * @param props.testId - Testing identifier
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
