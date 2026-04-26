import { useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
 * Componente de modal reutilizável baseado no dialog do daisyUI.
 * Utiliza Portals para evitar bugs de overflow em dispositivos móveis.
 */
export const Modal = ({
  open,
  onClose,
  children,
  title,
  subtitle,
  className = "",
  testId,
}: ModalProps): ReactElement | null => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      document.body.style.overflow = "hidden";
    } else if (!open && dialog.open) {
      dialog.close();
      document.body.style.overflow = "";
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

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={dialogRef}
      className="modal backdrop-blur-sm"
      data-testid={testId}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className={`modal-box max-w-lg shadow-2xl border border-base-300 ${className}`.trim()}>
        {title && (
          <div className="mb-4">
            <h3 className="font-bold text-xl tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-base-content/60 mt-1">{subtitle}</p>}
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto scrollbar-hide overscroll-contain">
          {children}
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>,
    document.body,
  );
};

interface ModalActionsProps {
  children: ReactNode;
  className?: string;
}

/**
 * Container para ações do modal (botões de confirmar/cancelar)
 */
export const ModalActions = ({ children, className = "" }: ModalActionsProps): ReactElement => {
  return <div className={`modal-action ${className}`.trim()}>{children}</div>;
};
