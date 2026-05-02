import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
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
 * Reusable modal component based on daisyUI dialog.
 * 
 * Uses React Portals to prevent overflow issues on mobile devices and ensures
 * proper accessibility by using the native <dialog> element.
 * 
 * @param props.open - Whether the modal is visible
 * @param props.onClose - Callback when the modal is requested to close
 * @param props.children - Modal content
 * @param props.title - Optional title displayed in the header
 * @param props.subtitle - Optional subtitle displayed below the title
 * @param props.className - Additional CSS classes for the modal box
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
 * Container for modal actions (typically confirm/cancel buttons).
 * 
 * @param props.children - Action elements (buttons)
 * @param props.className - Additional CSS classes
 */
export const ModalActions = ({ children, className = "" }: ModalActionsProps): ReactElement => {
  return <div className={`modal-action ${className}`.trim()}>{children}</div>;
};
