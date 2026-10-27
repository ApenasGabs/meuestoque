import type { NfceParsedDocument } from "../domain/nfceParser";

export interface NfceApiResponse {
  success?: boolean;
  data?: NfceParsedDocument;
  error?: string;
}

const CLIENT_TIMEOUT_MS = 10000;

/**
 * Consulta os dados da NFC-e a partir da URL do QR Code ou da chave de acesso de 44 dígitos.
 *
 * @param urlOrChave - URL pública do QR Code da SEFAZ ou chave numérica de 44 dígitos
 * @returns Promessa resolvida com os dados estruturados da NFC-e
 */
export const fetchNfceData = async (urlOrChave: string): Promise<NfceParsedDocument> => {
  const trimmed = urlOrChave.trim();
  if (!trimmed) {
    throw new Error("URL ou chave da nota fiscal não informada.");
  }

  const endpoint = "/api/nfce";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: trimmed }),
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(
        "A API retornou uma resposta inesperada. Em ambiente local, certifique-se de que o proxy da API está configurado.",
      );
    }

    const result = (await response.json()) as NfceApiResponse;

    if (!response.ok || !result.success || !result.data) {
      throw new Error(result.error || `Erro ao consultar nota fiscal (HTTP ${response.status})`);
    }

    return result.data;
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Tempo limite excedido ao consultar a nota fiscal. Tente novamente.");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
