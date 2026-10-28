import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NfceScannerModal } from "../NfceScannerModal";

vi.mock("../../lib/scannerDetector", () => ({
  createQrCodeScanner: vi.fn().mockResolvedValue({
    start: vi.fn(),
    stop: vi.fn(),
    setZoom: vi.fn(),
  }),
}));

describe("NfceScannerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "isSecureContext", { value: true, configurable: true });
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it("não deve renderizar nada quando open for false", () => {
    const { container } = render(
      <NfceScannerModal open={false} onClose={vi.fn()} onScanUrl={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("deve renderizar o modal com título, botões com aria-label e campo manual acessível", () => {
    render(<NfceScannerModal open={true} onClose={vi.fn()} onScanUrl={vi.fn()} />);

    expect(screen.getByText("Escanear QR Code da Nota Fiscal")).toBeInTheDocument();

    const manualInput = screen.getByTestId("nfce-scanner-manual-input");
    expect(manualInput).toBeInTheDocument();
    expect(manualInput).toHaveAttribute(
      "aria-label",
      "URL do QR Code ou chave de acesso de 44 dígitos",
    );

    const closeBtn = screen.getByTestId("nfce-scanner-close-button");
    expect(closeBtn).toHaveAttribute("aria-label", "Fechar scanner de nota fiscal");

    const zoomInBtn = screen.getByTestId("nfce-scanner-zoom-in");
    expect(zoomInBtn).toHaveAttribute("aria-label", "Aumentar zoom");

    const zoomOutBtn = screen.getByTestId("nfce-scanner-zoom-out");
    expect(zoomOutBtn).toHaveAttribute("aria-label", "Diminuir zoom");
  });

  it("deve permitir envio manual de URL ou chave ao clicar no botão Carregar", () => {
    const handleScanUrl = vi.fn();
    const handleClose = vi.fn();

    render(
      <NfceScannerModal open={true} onClose={handleClose} onScanUrl={handleScanUrl} />,
    );

    const manualInput = screen.getByTestId("nfce-scanner-manual-input");
    const submitBtn = screen.getByTestId("nfce-scanner-manual-submit");

    expect(submitBtn).toBeDisabled();

    fireEvent.change(manualInput, {
      target: { value: "35261000000000000000652080000474581006519038" },
    });

    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    expect(handleScanUrl).toHaveBeenCalledWith(
      "35261000000000000000652080000474581006519038",
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("deve disparar envio manual ao pressionar Enter no input", () => {
    const handleScanUrl = vi.fn();
    const handleClose = vi.fn();

    render(
      <NfceScannerModal open={true} onClose={handleClose} onScanUrl={handleScanUrl} />,
    );

    const manualInput = screen.getByTestId("nfce-scanner-manual-input");

    fireEvent.change(manualInput, {
      target: { value: "https://www.nfce.fazenda.sp.gov.br/test" },
    });
    fireEvent.keyDown(manualInput, { key: "Enter", code: "Enter" });

    expect(handleScanUrl).toHaveBeenCalledWith("https://www.nfce.fazenda.sp.gov.br/test");
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("deve atualizar os controles de zoom ao clicar nos botões", () => {
    render(<NfceScannerModal open={true} onClose={vi.fn()} onScanUrl={vi.fn()} />);

    const zoomLevel = screen.getByTestId("nfce-scanner-zoom-level");
    expect(zoomLevel).toHaveTextContent("1.0x");

    const zoomInBtn = screen.getByTestId("nfce-scanner-zoom-in");
    fireEvent.click(zoomInBtn);
    expect(zoomLevel).toHaveTextContent("1.5x");

    const zoomOutBtn = screen.getByTestId("nfce-scanner-zoom-out");
    fireEvent.click(zoomOutBtn);
    expect(zoomLevel).toHaveTextContent("1.0x");
  });

  it("deve exibir aviso e permitir digitação manual quando contexto for inseguro (HTTP)", () => {
    Object.defineProperty(window, "isSecureContext", { value: false, configurable: true });

    render(<NfceScannerModal open={true} onClose={vi.fn()} onScanUrl={vi.fn()} />);

    expect(screen.getByText(/conexões seguras \(HTTPS\)/)).toBeInTheDocument();
    expect(screen.getByTestId("nfce-scanner-manual-input")).toBeInTheDocument();
  });
});
