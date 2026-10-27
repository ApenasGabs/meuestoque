import type { NfceParsedDocument } from "../domain/nfceParser";

export interface NfceApiResponse {
  success?: boolean;
  data?: NfceParsedDocument;
  error?: string;
}

/**
 * Consulta os dados da NFC-e a partir da URL do QR Code ou da chave de acesso de 44 dígitos.
 */
export const fetchNfceData = async (urlOrChave: string): Promise<NfceParsedDocument> => {
  const trimmed = urlOrChave.trim();
  if (!trimmed) {
    throw new Error("URL ou chave da nota fiscal não informada.");
  }

  const endpoint = "/api/nfce";

  const response = await fetch(endpoint, {
    method: "POST",
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
};
