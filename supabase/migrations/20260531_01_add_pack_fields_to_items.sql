ALTER TABLE public.items
ADD COLUMN pack_label text,
ADD COLUMN pack_size numeric,
ADD COLUMN pack_unit text;

COMMENT ON COLUMN public.items.pack_label IS 'Embalagem informada no momento da compra (ex: "pacote", "caixa")';
COMMENT ON COLUMN public.items.pack_size IS 'Rendimento por embalagem em unidade de estoque (ex: 5 para 5 kg)';
COMMENT ON COLUMN public.items.pack_unit IS 'Unidade do rendimento (ex: "Kg", "g", "Un")';
