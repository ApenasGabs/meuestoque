BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_bulk_update_stock_validity(
  p_item_ids uuid[],
  p_data_validade date,
  p_nao_aplica boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_item_id uuid;
  v_product_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT product_id INTO v_product_id FROM public.stock_items WHERE id = v_item_id;
    
    IF p_nao_aplica THEN
      UPDATE public.stock_items
      SET validade_nao_aplica = true, data_validade_alerta = NULL
      WHERE id = v_item_id;
      
      IF v_product_id IS NOT NULL THEN
        UPDATE public.product_catalog SET perecivel = false WHERE id = v_product_id;
      END IF;
    ELSE
      UPDATE public.stock_items
      SET data_validade_alerta = p_data_validade, validade_nao_aplica = false
      WHERE id = v_item_id;
    END IF;
    
    -- Record bulk movement
    INSERT INTO public.stock_movements (item_id, stock_item_id, tipo, quantidade, unidade, observacao, origem, criado_por)
    SELECT id, id, 'ajuste_validade_bulk', quantidade_atual, unidade, 
           CASE WHEN p_nao_aplica THEN 'Marcado como não perecível' ELSE 'Ajuste de validade em lote: ' || p_data_validade::text END,
           'adjustment', v_user_id
    FROM public.stock_items WHERE id = v_item_id;
  END LOOP;
END;
$$;

COMMIT;
