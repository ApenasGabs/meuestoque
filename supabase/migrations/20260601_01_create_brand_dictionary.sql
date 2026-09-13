-- Migration: 20260601_01_create_brand_dictionary.sql
-- Objetivo: Criação da tabela de dicionário de marcas e colunas aditivas para marca/produto base

BEGIN;

-- 1. Criação da tabela de dicionário de marcas
CREATE TABLE IF NOT EXISTS public.brand_dictionary (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome text NOT NULL UNIQUE,
    nome_normalizado text NOT NULL UNIQUE,
    origem text NOT NULL DEFAULT 'tenda',
    ativo boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Índice para busca rápida ignorando maiúsculas/acentos
CREATE INDEX IF NOT EXISTS ix_brand_dictionary_normalizado 
    ON public.brand_dictionary (nome_normalizado);

-- 3. Políticas de Segurança (RLS)
ALTER TABLE public.brand_dictionary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read for all authenticated users" 
    ON public.brand_dictionary FOR SELECT 
    TO authenticated 
    USING (true);

CREATE POLICY "Allow insert for all authenticated users" 
    ON public.brand_dictionary FOR INSERT 
    TO authenticated 
    WITH CHECK (true);

-- 4. Evolução aditiva em items
ALTER TABLE public.items
    ADD COLUMN IF NOT EXISTS marca text,
    ADD COLUMN IF NOT EXISTS produto_base text;

COMMENT ON COLUMN public.items.marca IS 'Marca do produto (ex: Camil, Namorado, Pilão)';
COMMENT ON COLUMN public.items.produto_base IS 'Nome canônico/base do produto (ex: Feijão Preto, Arroz Branco, Café)';

-- 5. Evolução aditiva em product_catalog
ALTER TABLE public.product_catalog
    ADD COLUMN IF NOT EXISTS marca text,
    ADD COLUMN IF NOT EXISTS produto_base text;

COMMENT ON COLUMN public.product_catalog.marca IS 'Marca do produto (ex: Camil, Namorado, Pilão)';
COMMENT ON COLUMN public.product_catalog.produto_base IS 'Nome canônico/base do produto (ex: Feijão Preto, Arroz Branco, Café)';

COMMIT;

