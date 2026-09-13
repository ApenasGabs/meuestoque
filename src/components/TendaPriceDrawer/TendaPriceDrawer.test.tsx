import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TendaPriceDrawer } from "./TendaPriceDrawer";
import * as tendaService from "../../services/tendaService";

describe("TendaPriceDrawer", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockItems = [
    { id: "1", name: "Arroz 5kg", quantity: 1, unit: "pct", currentPrice: null },
    { id: "2", name: "Feijão 1kg", quantity: 2, unit: "pct", currentPrice: 8.5 },
  ];

  it("deve consultar a filial e cotar os itens ao abrir a gaveta", async () => {
    vi.spyOn(tendaService, "resolveTendaBranchByCep").mockResolvedValueOnce({
      branchId: 40,
      branchName: "Ceasa - Campinas",
      deliveryPrice: 14.9,
      deliveryDays: 2,
      address: "Vila Boa Vista, Campinas - SP",
      available: true,
    });

    vi.spyOn(tendaService, "quoteShoppingItemOnTenda").mockImplementation(async (name) => {
      if (name.includes("Arroz")) {
        return {
          itemName: name,
          baseProduct: name,
          requestedBrand: null,
          sameBrandOffer: null,
          cheaperAlternativeOffer: null,
          targetSize: { value: 5, unit: "kg" },
          startingFromPrice: 19.45,
          recommended: {
            id: 101,
            name: "Arroz Tipo 1 Pateko 5kg",
            brand: "Pateko",
            price: 19.45,
            wholesalePrices: [{ minQuantity: 4, price: 18.5 }],
            url: "https://tenda/pateko-5kg",
            thumbnail: null,
            inStock: true,
          },
          options: [],
          totalFound: 1,
        };
      }
      return {
        itemName: name,
        baseProduct: name,
        requestedBrand: null,
        sameBrandOffer: null,
        cheaperAlternativeOffer: null,
        targetSize: { value: 1, unit: "kg" },
        startingFromPrice: 6.89,
        recommended: {
          id: 102,
          name: "Feijão 1kg",
          brand: "5 Estrelas",
          price: 6.89,
          wholesalePrices: null,
          url: "https://tenda/feijao-1kg",
          thumbnail: null,
          inStock: true,
        },
        options: [],
        totalFound: 1,
      };
    });

    render(
      <TendaPriceDrawer open={true} onClose={vi.fn()} items={mockItems} defaultCep="13064-789" />,
    );

    expect(screen.getByText("Cotação Tenda Atacado")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Loja:\s*Ceasa - Campinas/i)).toBeInTheDocument();
      expect(screen.getByText(/Frete:\s*R\$\s*14\.90/i)).toBeInTheDocument();
      expect(screen.getByText("Arroz Tipo 1 Pateko 5kg")).toBeInTheDocument();
    });
  });

  it("deve permitir aplicar preço individualmente em um item", async () => {
    vi.spyOn(tendaService, "resolveTendaBranchByCep").mockResolvedValueOnce({
      branchId: 40,
      branchName: "Ceasa - Campinas",
      deliveryPrice: 14.9,
      deliveryDays: 2,
      address: "Vila Boa Vista, Campinas - SP",
      available: true,
    });

    vi.spyOn(tendaService, "quoteShoppingItemOnTenda").mockResolvedValueOnce({
      itemName: "Arroz 5kg",
      baseProduct: "Arroz 5kg",
      requestedBrand: null,
      sameBrandOffer: null,
      cheaperAlternativeOffer: null,
      targetSize: { value: 5, unit: "kg" },
      startingFromPrice: 19.45,
      recommended: {
        id: 101,
        name: "Arroz Tipo 1 Pateko 5kg",
        brand: "Pateko",
        price: 19.45,
        wholesalePrices: null,
        url: "https://tenda/pateko-5kg",
        thumbnail: null,
        inStock: true,
      },
      options: [],
      totalFound: 1,
    });

    const onApplyPrice = vi.fn();

    render(
      <TendaPriceDrawer
        open={true}
        onClose={vi.fn()}
        items={[mockItems[0]]}
        defaultCep="13064-789"
        onApplyPrice={onApplyPrice}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Usar Preço")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Usar Preço"));
    expect(onApplyPrice).toHaveBeenCalledWith("1", 19.45);
  });
});
