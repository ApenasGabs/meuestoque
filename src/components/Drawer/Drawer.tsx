import { useEffect, useRef, useId, type ReactElement, type ReactNode } from "react";
import { Button } from "../Button/Button";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  side?: "start" | "end";
  width?: string;
  className?: string;
  testId?: string;
}

/**
 * Componente de drawer (painel lateral) baseado no daisyUI drawer
 * Usa um checkbox controlado para abrir/fechar o drawer.
 *
 * @param open - Se o drawer deve estar visível
 * @param onClose - Callback ao fechar o drawer (overlay click)
 * @param children - Conteúdo do drawer
 * @param title - Título do drawer
 * @param subtitle - Subtítulo/descrição
 * @param side - Lado do drawer ("start" = esquerda, "end" = direita)
 * @param width - Largura do drawer (padrão: "w-80")
 * @param className - Classes CSS adicionais para o conteúdo
 * @param testId - ID para testes
 */
export const Drawer = ({
  open,
  onClose,
  children,
  title,
  subtitle,
  side = "end",
  width = "w-80 sm:w-96",
  className = "",
  testId,
}: DrawerProps): ReactElement => {
  const generatedId = useId();
  const drawerId = `drawer-${generatedId}`;

  const checkboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.checked = open;
    }
  }, [open]);

  const sideClass = side === "end" ? "drawer-end" : "";

  return (
    <div
      className={`drawer ${sideClass} z-40 fixed inset-0 pointer-events-none`}
      data-testid={testId}
    >
      <input
        id={drawerId}
        ref={checkboxRef}
        type="checkbox"
        className="drawer-toggle"
        checked={open}
        onChange={(event) => {
          if (!event.target.checked) {
            onClose();
          }
        }}
      />
      <div className="drawer-side pointer-events-auto">
        <label
          htmlFor={drawerId}
          aria-label="close sidebar"
          className="drawer-overlay"
        />
        <div
          className={`bg-base-100 min-h-full ${width} flex flex-col shadow-2xl ${className}`.trim()}
        >
          {title && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-base-300">
              <div>
                <h2 className="font-semibold text-sm">{title}</h2>
                {subtitle && (
                  <p className="text-xs text-base-content/60">{subtitle}</p>
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                aria-label="Fechar"
              >
                ✕
              </Button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto p-5">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};
