import { useEffect, useRef, useState, type ReactElement } from "react";
import { Modal } from "../Modal/Modal";
import { Alert } from "../Alert/Alert";
import { Badge } from "../Badge/Badge";
import { Input } from "../Input/Input";
import { Button } from "../Button/Button";
import { createBarcodeScanner, type ScannerInstance } from "../../lib/scannerDetector";
import { isValidEan, isEanInCooldown, markEanProcessed } from "../../lib/barcodeService";

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScan: (ean: string) => void;
  continuous?: boolean;
}

/**
 * Modal que exibe o leitor de código de barras.
 * Permite leitura via câmera com suporte a zoom digital e
 * oferece um fallback para digitação manual caso a leitura falhe.
 *
 * @param props.open - Estado de exibição do modal
 * @param props.onClose - Callback disparado para fechar o modal
 * @param props.onScan - Callback disparado quando um código é lido com sucesso
 * @param props.continuous - Se verdadeiro, o modal não fecha após a primeira leitura
 */
export const BarcodeScannerModal = ({
  open,
  onClose,
  onScan,
  continuous = false,
}: BarcodeScannerModalProps): ReactElement | null => {
  const [error, setError] = useState<string | null>(null);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [manualEan, setManualEan] = useState("");
  const scannerRef = useRef<ScannerInstance | null>(null);
  const containerId = "barcode-scanner-container";

  // Check if we are in a secure context
  const canUseCamera = typeof window !== "undefined" && window.isSecureContext;

  useEffect(() => {
    if (!open || !canUseCamera) return;

    let mounted = true;

    const startScanner = async () => {
      try {
        setError(null);
        const scanner = await createBarcodeScanner();
        scannerRef.current = scanner;

        await scanner.start(containerId, (ean: string) => {
          if (!mounted) return;

          // Cooldown check for continuous mode
          if (continuous && isEanInCooldown(ean)) return;
          markEanProcessed(ean);

          setLastScanned(ean);
          
          if (navigator.vibrate) {
            navigator.vibrate(100);
          }

          onScan(ean);

          if (!continuous) {
            onClose();
          } else {
            // Clear last scanned text after 2 seconds
            setTimeout(() => {
              if (mounted) setLastScanned(null);
            }, 2000);
          }
        });
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Erro ao iniciar a câmera");
        }
      }
    };

    // Small delay to ensure the modal container is rendered
    setTimeout(() => {
      if (mounted) {
        void startScanner();
      }
    }, 100);

    return () => {
      mounted = false;
      if (scannerRef.current) {
        void scannerRef.current.stop();
        scannerRef.current = null;
      }
    };
  }, [open, continuous, onClose, onScan, canUseCamera]);

  useEffect(() => {
    if (scannerRef.current) {
      scannerRef.current.setZoom(zoom);
    }
  }, [zoom]);

  if (!canUseCamera && open) {
    return (
      <Modal open={open} onClose={onClose} title="Scanner indisponível">
        <Alert type="warning">
          A câmera só pode ser acessada em conexões seguras (HTTPS).
        </Alert>
      </Modal>
    );
  }

  return (
    <Modal 
      open={open} 
      onClose={onClose} 
      title="Ler Código de Barras"
      className="p-4"
    >
      <Button 
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="btn-circle absolute right-2 top-2 z-50"
        aria-label="Fechar scanner"
        data-testid="scanner-close-button"
      >
        ✕
      </Button>

      {error ? (
        <Alert type="warning">
          Precisamos de acesso à câmera para ler os códigos.
          Verifique as configurações do seu navegador.
          {error && <div className="text-xs mt-2 opacity-70">{error}</div>}
        </Alert>
      ) : (
        <div className="relative w-full aspect-square bg-base-300 rounded-xl overflow-hidden mt-2">
          {/* Container div for both Native and Fallback scanners */}
          <div 
            id={containerId} 
            className="w-full h-full origin-center"
          />
          
          {/* Overlay scanning line effect */}
          <div className="absolute inset-0 pointer-events-none z-10">
            <div className="w-full h-0.5 bg-red-500/80 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-[scan_2s_ease-in-out_infinite]" />
          </div>

          {/* Zoom Controls */}
          <div className="absolute bottom-4 left-0 right-0 flex justify-center px-4 z-20">
            <div className="bg-base-100/80 backdrop-blur rounded-full px-2 py-1 flex items-center gap-2 shadow-lg">
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setZoom(z => Math.max(1, z - 0.5))} 
                className="btn-circle" 
                aria-label="Diminuir zoom"
                data-testid="scanner-zoom-out"
              >
                -
              </Button>
              <span className="font-mono text-sm w-10 text-center" data-testid="scanner-zoom-level">{zoom.toFixed(1)}x</span>
              <Button 
                variant="ghost"
                size="sm"
                onClick={() => setZoom(z => Math.min(3, z + 0.5))} 
                className="btn-circle" 
                aria-label="Aumentar zoom"
                data-testid="scanner-zoom-in"
              >
                +
              </Button>
            </div>
          </div>

          {lastScanned && (
            <Badge 
              variant="success" 
              className="absolute top-4 left-1/2 -translate-x-1/2 shadow-lg animate-in fade-in slide-in-from-top-4 flex items-center gap-2 p-3 font-bold z-20"
            >
              ✓ {lastScanned}
            </Badge>
          )}
        </div>
      )}

      {continuous && !error && (
        <div className="mt-4 text-center text-sm text-base-content/60 animate-pulse">
          Escaneando em modo contínuo...
        </div>
      )}

      {/* Manual Input Fallback */}
      <div className="mt-6 flex gap-2 items-center">
        <Input 
          value={manualEan}
          onChange={(e) => setManualEan(e.target.value)}
          placeholder="Ou digite o código de barras..."
          className="flex-1"
          data-testid="scanner-manual-input"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && manualEan.trim()) {
              const ean = manualEan.trim();
              if (isValidEan(ean)) {
                onScan(ean);
                if (!continuous) onClose();
                setManualEan("");
              } else {
                setError("O código digitado é inválido. Digite apenas de 8 a 14 números.");
              }
            }
          }}
        />
        <Button 
          onClick={() => {
            if (manualEan.trim()) {
              const ean = manualEan.trim();
              if (isValidEan(ean)) {
                onScan(ean);
                if (!continuous) onClose();
                setManualEan("");
              } else {
                setError("O código digitado é inválido. Digite apenas de 8 a 14 números.");
              }
            }
          }}
          disabled={!manualEan.trim()}
          data-testid="scanner-manual-submit"
        >
          OK
        </Button>
      </div>
    </Modal>
  );
};
