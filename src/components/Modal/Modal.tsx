import { useEffect, useRef, type ReactElement, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
  testId?: string;
}

/**
 * Componente de modal reutilizável baseado no dialog do daisyUI
 *
 * @param open - Se o modal deve estar visível
 * @param onClose - Callback ao fechar o modal (backdrop click ou ESC)
 * @param children - Conteúdo do modal
 * @param title - Título do modal
 * @param subtitle - Subtítulo/descrição do modal
 * @param className - Classes CSS adicionais para o modal-box
 * @param testId - ID para testes
 */
export const Modal = ({
  open,
  onClose,
  children,
  title,
  subtitle,
  className = "",
  testId,
}: ModalProps): ReactElement => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = (): void => {
      onClose();
    };

    dialog.addEventListener("close", handleClose);

    return () => {
      dialog.removeEventListener("close", handleClose);
    };
  }, [onClose]);

  return (
    <dialog ref={dialogRef} className="modal" data-testid={testId}>
      <div className={`modal-box max-w-lg ${className}`.trim()}>
        {title && (
          <div className="mb-4">
            <h3 className="font-bold text-lg">{title}</h3>
            {subtitle && (
              <p className="text-xs text-base-content/60">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="submit">close</button>
      </form>
    </dialog>
  );
};

interface ModalActionsProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container para ações do modal (botões de confirmar/cancelar)
 */
export const ModalActions = ({
  children,
  className = "",
}: ModalActionsProps): ReactElement => {
  return (
    <div className={`modal-action ${className}`.trim()}>{children}</div>
  );
};
