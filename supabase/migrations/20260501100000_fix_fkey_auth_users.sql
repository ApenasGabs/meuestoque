BEGIN;

ALTER TABLE public.stock_lots
DROP CONSTRAINT IF EXISTS stock_lots_created_by_fkey;

ALTER TABLE public.stock_lots
ADD CONSTRAINT stock_lots_created_by_fkey
FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.shopping_lists
DROP CONSTRAINT IF EXISTS shopping_lists_fechado_por_fkey;

ALTER TABLE public.shopping_lists
ADD CONSTRAINT shopping_lists_fechado_por_fkey
FOREIGN KEY (fechado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

COMMIT;
