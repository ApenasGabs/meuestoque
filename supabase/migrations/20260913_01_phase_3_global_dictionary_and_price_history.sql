-- Migration: 20260913_01_phase_3_global_dictionary_and_price_history.sql
-- Objetivo: Fase 3 - Dicionário Global de Marcas com Aliases, Produtos Base Globais e Histórico de Preços de Supermercado

BEGIN;

-- 1. Tabela Global de Marcas (com suporte a Aliases)
CREATE TABLE IF NOT EXISTS public.global_brands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    nome_normalizado text NOT NULL UNIQUE,
    aliases text[] NOT NULL DEFAULT '{}',
    origem text NOT NULL DEFAULT 'tenda',
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_global_brands_normalizado 
    ON public.global_brands (nome_normalizado);

-- RLS para global_brands
ALTER TABLE public.global_brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read global_brands for authenticated users"
    ON public.global_brands FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert global_brands for authenticated users"
    ON public.global_brands FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update global_brands for authenticated users"
    ON public.global_brands FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Backfill inicial a partir de brand_dictionary (se existir)
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'brand_dictionary'
    ) THEN
        INSERT INTO public.global_brands (id, nome, nome_normalizado, origem, ativo, created_at)
        SELECT id, nome, nome_normalizado, origem, ativo, created_at
        FROM public.brand_dictionary
        ON CONFLICT (nome_normalizado) DO NOTHING;
    END IF;
END $$;

-- 2. Tabela Global de Produtos Base Canônicos
CREATE TABLE IF NOT EXISTS public.global_base_products (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    nome_normalizado text NOT NULL UNIQUE,
    categoria_padrao text,
    unidade_sugerida text,
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_global_base_products_normalizado
    ON public.global_base_products (nome_normalizado);

-- RLS para global_base_products
ALTER TABLE public.global_base_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read global_base_products for authenticated users"
    ON public.global_base_products FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert global_base_products for authenticated users"
    ON public.global_base_products FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update global_base_products for authenticated users"
    ON public.global_base_products FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- 3. Tabela de Histórico de Preços de Supermercado
CREATE TABLE IF NOT EXISTS public.store_price_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    loja text NOT NULL DEFAULT 'tenda',
    filial_id integer NOT NULL,
    filial_nome text,
    produto_base text NOT NULL,
    marca text,
    produto_nome text NOT NULL,
    preco numeric(10,2) NOT NULL,
    preco_atacado numeric(10,2),
    qtd_atacado numeric(10,2),
    tamanho_valor numeric(10,2),
    tamanho_unidade text,
    url text,
    data_cotacao date NOT NULL DEFAULT current_date,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_store_price_history_item_daily UNIQUE (loja, filial_id, produto_nome, data_cotacao)
);

CREATE INDEX IF NOT EXISTS ix_store_price_history_lookup
    ON public.store_price_history (produto_base, data_cotacao DESC);

CREATE INDEX IF NOT EXISTS ix_store_price_history_marca
    ON public.store_price_history (marca, data_cotacao DESC);

-- RLS para store_price_history
ALTER TABLE public.store_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read store_price_history for authenticated users"
    ON public.store_price_history FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Allow insert store_price_history for authenticated users"
    ON public.store_price_history FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Allow update store_price_history for authenticated users"
    ON public.store_price_history FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

COMMIT;

