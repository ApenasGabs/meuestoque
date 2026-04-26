import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";

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
 * Componente de menu lateral (Drawer) robusto e compatível com iOS.
 * Evita o "checkbox hack" do daisyUI para garantir funcionamento em todos os navegadores mobile.
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
}: DrawerProps): ReactElement | null => {
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(open);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Controla o ciclo de vida da renderização para permitir animações de saída
  useEffect(() => {
    if (open) {
      setShouldRender(true);
    } else {
      const timer = setTimeout(() => setShouldRender(false), 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  // Handle Escape key
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  // Bloqueia o scroll do body quando o drawer está aberto
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!mounted || (!open && !shouldRender)) return null;

  const isRight = side === "end";

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex overflow-hidden ${open ? "" : "pointer-events-none"}`}
      style={{ width: "100vw", left: 0 }}
      data-testid={testId}
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ease-in-out ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side Panel */}
      <div
        className={`
          fixed top-0 bottom-0 h-dvh ${width} max-w-[90vw] bg-base-100 shadow-2xl 
          transition-transform duration-300 ease-in-out flex flex-col
          ${isRight ? "right-0" : "left-0"}
          ${open ? "translate-x-0" : isRight ? "translate-x-full" : "-translate-x-full"}
          ${className}
        `.trim()}
        style={{
          willChange: "transform",
          transform: open 
            ? "translate3d(0, 0, 0)" 
            : isRight ? "translate3d(100%, 0, 0)" : "translate3d(-100%, 0, 0)"
        }}
      >
        {(title || subtitle) && (
          <div className="p-5 border-b border-base-300 bg-base-100/50 backdrop-blur-md sticky top-0 z-20">
            {title && (
              <h3 className="font-bold text-xl tracking-tight text-base-content">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs font-medium text-base-content/50 mt-1">
                {subtitle}
              </p>
            )}
          </div>
        )}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-hide overscroll-contain">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};



