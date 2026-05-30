declare global {
  class BarcodeDetector {
    constructor(options?: { formats: string[] });
    detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    static getSupportedFormats(): Promise<string[]>;
  }
  interface Window {
    BarcodeDetector?: typeof BarcodeDetector;
  }
}

export interface ScannerInstance {
  start(containerId: string, onScan: (ean: string) => void): Promise<void>;
  stop(): Promise<void>;
}

export async function createBarcodeScanner(): Promise<ScannerInstance> {
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      // Feature check: ensure it supports EAN/UPC
      const formats = await window.BarcodeDetector?.getSupportedFormats() || [];
      if (formats.includes('ean_13') || formats.includes('upc_a')) {
        return new NativeBarcodeScanner();
      }
    } catch {
      // Fallthrough to fallback on error
    }
  }

  return new FallbackBarcodeScanner();
}

class NativeBarcodeScanner implements ScannerInstance {
  private detector: BarcodeDetector;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;
  private rafId: number | null = null;
  private isScanning = false;

  constructor() {
    this.detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  }

  async start(containerId: string, onScan: (ean: string) => void): Promise<void> {
    const container = document.getElementById(containerId);
    if (!container) throw new Error("Container element not found");

    this.video = document.createElement("video");
    this.video.style.width = "100%";
    this.video.style.height = "100%";
    this.video.style.objectFit = "cover";
    this.video.setAttribute("playsinline", "true"); // required for iOS
    container.appendChild(this.video);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" } 
      });
      this.video.srcObject = this.stream;
      await this.video.play();
    } catch {
      throw new Error("Camera permission denied or not available");
    }

    this.isScanning = true;
    
    const scanLoop = async () => {
      if (!this.isScanning || !this.video) return;
      
      if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
        try {
          const barcodes = await this.detector.detect(this.video);
          if (barcodes.length > 0) {
            onScan(barcodes[0].rawValue);
          }
        } catch {
          // ignore detection errors (e.g. empty frames)
        }
      }
      this.rafId = requestAnimationFrame(scanLoop);
    };

    scanLoop();
  }

  async stop(): Promise<void> {
    this.isScanning = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.video && this.video.parentNode) {
      this.video.parentNode.removeChild(this.video);
    }
    this.stream = null;
    this.video = null;
  }
}

class FallbackBarcodeScanner implements ScannerInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private scanner: any = null;

  async start(containerId: string, onScan: (ean: string) => void): Promise<void> {
    const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import('html5-qrcode');
    
    this.scanner = new Html5Qrcode(containerId, {
      verbose: false,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
      ]
    });
    
    await this.scanner.start(
      { facingMode: "environment" },
      { 
        fps: 10, 
        qrbox: { width: 250, height: 150 },
        aspectRatio: 1.0
      },
      (decodedText: string) => {
        onScan(decodedText);
      },
      () => { /* ignore decode errors */ }
    );
  }

  async stop(): Promise<void> {
    if (this.scanner) {
      try {
        await this.scanner.stop();
        this.scanner.clear();
      } catch {
        // ignore errors during stop
      }
      this.scanner = null;
    }
  }
}
