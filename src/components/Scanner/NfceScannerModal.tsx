import { useEffect, useRef, useState, type ReactElement } from "react";
import { Modal } from "../Modal/Modal";
import { Alert } from "../Alert/Alert";
import { Input } from "../Input/Input";
import { Button } from "../Button/Button";
import { createQrCodeScanner, type ScannerInstance } from "../../lib/scannerDetector";

export interface NfceScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanUrl: (urlOrChave: string) => void;
}

/**
 * Modal para leitura do QR Code da Nota Fiscal de Consumidor Eletrônica (NFC-e).
 * Permite leitura pela câmera com controle de zoom e campo alternativo para colar a URL ou chave.
 *
 * @param props.open - Indica se o modal está aberto
 * @param props.onClose - Callback disparado ao fechar o modal
 * @param props.onScanUrl - Callback disparado ao capturar a URL ou chave da nota fiscal
 * @returns Elemento React do modal de leitura de QR Code ou null
 */
export const NfceScannerModal = ({
  open,
  onClose,
  onScanUrl,
}: NfceScannerModalProps): ReactElement | null => {
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [manualInput, setManualInput] = useState("");
  const scannerRef = useRef<ScannerInstance | null>(null);
  const containerId = "nfce-qr-scanner-container";

  const canUseCamera = typeof window !== "undefined" && window.isSecureContext;

  useEffect(() => {
    if (!open || !canUseCamera) return;

    let mounted = true;

    const startScanner = async () => {
      try {
        setError(null);
        const scanner = await createQrCodeScanner();
        scannerRef.current = scanner;

        await scanner.start(containerId, (scannedText: string) => {
          if (!mounted) return;

          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          onScanUrl(scannedText);
          onClose();
        });
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Erro ao acessar a câmera. Você também pode colar o link da nota abaixo.",
          );
        }
      }
    };

    const timer = setTimeout(() => {
      if (mounted) {
        void startScanner();
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (scannerRef.current) {
        void scannerRef.current.stop();
        scannerRef.current = null;
      }
    };
  }, [open, onClose, onScanUrl, canUseCamera]);

  useEffect(() => {
    if (scannerRef.current) {
      scannerRef.current.setZoom(zoom);
    }
  }, [zoom]);

  const handleManualSubmit = (): void => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;

    onScanUrl(trimmed);
    onClose();
    setManualInput("");
  };

  if (!canUseCamera && open) {
    return (
      <Modal open={open} onClose={onClose} title="Escanear Nota Fiscal" data-testid="nfce-scanner-modal">
        <Alert type="warning">
          A câmera só pode ser acessada em conexões seguras (HTTPS).
        </Alert>
        <div className="mt-4 flex gap-2 items-center">
          <Input
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Cole o link da nota ou a chave de 44 dígitos..."
            aria-label="URL do QR Code ou chave de acesso de 44 dígitos"
            className="flex-1"
            data-testid="nfce-scanner-manual-input"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleManualSubmit();
            }}
          />
          <Button
            onClick={handleManualSubmit}
            disabled={!manualInput.trim()}
            data-testid="nfce-scanner-manual-submit"
          >
            OK
          </Button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Escanear QR Code da Nota Fiscal"
      className="p-4"
      data-testid="nfce-scanner-modal"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="btn-circle absolute right-2 top-2 z-50"
        aria-label="Fechar scanner de nota fiscal"
        data-testid="nfce-scanner-close-button"
      >
        ✕
      </Button>

      {error ? (
        <Alert type="warning">
          Não foi possível iniciar a câmera para leitura do QR Code.
          {error && <div className="text-xs mt-2 opacity-70">{error}</div>}
        </Alert>
      ) : (
        <div className="relative w-full aspect-square bg-base-300 rounded-xl overflow-hidden mt-2">
          <div id={containerId} className="w-full h-full origin-center" />

          <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
            <div className="w-56 h-56 border-2 border-primary/80 rounded-2xl relative animate-pulse">
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-primary" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-primary" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-primary" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-primary" />
            </div>
          </div>

          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 z-20">
            <div className="bg-base-100/80 backdrop-blur rounded-full px-2 py-1 flex items-center gap-2 shadow-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
                className="btn-circle"
                aria-label="Diminuir zoom"
                data-testid="nfce-scanner-zoom-out"
              >
                -
              </Button>
              <span className="font-mono text-sm w-10 text-center" data-testid="nfce-scanner-zoom-level">
                {zoom.toFixed(1)}x
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setZoom((z) => Math.min(3, z + 0.5))}
                className="btn-circle"
                aria-label="Aumentar zoom"
                data-testid="nfce-scanner-zoom-in"
              >
                +
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2 items-center">
        <Input
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          placeholder="Ou cole a URL da nota ou chave..."
          aria-label="URL do QR Code ou chave de acesso de 44 dígitos"
          className="flex-1"
          data-testid="nfce-scanner-manual-input"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleManualSubmit();
          }}
        />
        <Button
          onClick={handleManualSubmit}
          disabled={!manualInput.trim()}
          data-testid="nfce-scanner-manual-submit"
        >
          Carregar
        </Button>
      </div>
    </Modal>
  );
};
