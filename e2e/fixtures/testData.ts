declare const process: {
  env: Record<string, string | undefined>;
};

/**
 * Unique suffix generator to prevent test data collisions across parallel runs.
 *
 * @returns Unique alphanumeric suffix based on timestamp + random component
 */
export const uniqueSuffix = (): string =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Test credentials — uses environment variables with fallback defaults.
 * For local development, set these in .env.local.
 */
export const TEST_CREDENTIALS = {
  email: process.env.E2E_EMAIL ?? "e2e-test@meuestoque.local",
  password: process.env.E2E_PASSWORD ?? "senhateste",
} as const;

/**
 * Generates a unique test email to avoid conflicts with existing users.
 *
 * @param prefix - Optional prefix for the email local part
 * @returns Unique email string
 */
export const testEmail = (prefix = "e2e"): string =>
  `${prefix}+${uniqueSuffix()}@meuestoque.test`;

/**
 * Default test group name generator.
 *
 * @returns Unique group name
 */
export const testGroupName = (): string => `Grupo E2E ${uniqueSuffix()}`;

/**
 * Default stock product templates for seeding.
 */
export const STOCK_PRODUCTS = {
  arroz: {
    nome: "Arroz",
    categoria: "Grãos",
    unidade: "kg",
    quantidade: 5,
    quantidade_minima: 2,
    tamanho_porcao: 1,
  },
  feijao: {
    nome: "Feijão",
    categoria: "Grãos",
    unidade: "kg",
    quantidade: 3,
    quantidade_minima: 1,
    tamanho_porcao: 1,
  },
  leite: {
    nome: "Leite",
    categoria: "Laticínios",
    unidade: "L",
    quantidade: 2,
    quantidade_minima: 3,
    tamanho_porcao: 1,
  },
  cafe: {
    nome: "Café",
    categoria: "Bebidas",
    unidade: "un",
    quantidade: 0,
    quantidade_minima: 1,
    tamanho_porcao: 1,
  },
} as const;

/**
 * Shopping list item templates for seeding.
 */
export const LIST_ITEMS = {
  basic: [
    { nome: "Arroz", quantidade: "2 kg", categoria: "Grãos" },
    { nome: "Feijão", quantidade: "1 kg", categoria: "Grãos" },
    { nome: "Açúcar", quantidade: "1 kg", categoria: "Outros" },
  ],
  withPrices: [
    { nome: "Arroz", quantidade: "2 kg", categoria: "Grãos", preco: 12.9 },
    { nome: "Feijão", quantidade: "1 kg", categoria: "Grãos", preco: 8.5 },
  ],
} as const;
