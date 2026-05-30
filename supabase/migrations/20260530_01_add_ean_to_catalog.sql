-- Adiciona coluna EAN ao catálogo de produtos
-- Usa tipo TEXT para consistência com o schema existente
ALTER TABLE public.product_catalog
  ADD COLUMN IF NOT EXISTS ean text DEFAULT NULL;

-- Validação: EAN deve ter entre 8 e 14 caracteres numéricos (EAN-8, UPC-A, EAN-13)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_product_catalog_ean_format'
  ) THEN
    ALTER TABLE public.product_catalog
      ADD CONSTRAINT chk_product_catalog_ean_format
      CHECK (ean IS NULL OR (length(ean) BETWEEN 8 AND 14 AND ean ~ '^\\d+$'));
  END IF;
END
$$;

-- Índice UNIQUE parcial: garante que o mesmo código de barras
-- não pode ser mapeado a dois nomes diferentes dentro do mesmo grupo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = 'ux_product_catalog_group_ean'
  ) THEN
    CREATE UNIQUE INDEX ux_product_catalog_group_ean
      ON public.product_catalog (group_id, ean)
      WHERE ean IS NOT NULL;
  END IF;
END
$$;

COMMENT ON COLUMN public.product_catalog.ean
  IS 'Código de barras EAN-8/EAN-13/UPC-A. Usado para auto-preenchimento via scanner. Único por grupo.';
