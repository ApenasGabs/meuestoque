BEGIN;

CREATE OR REPLACE FUNCTION public.rpc_bulk_update_stock_validity(
  p_item_ids uuid[],
  p_data_validade date,
  p_nao_aplica boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_item_id uuid;
  v_product_id uuid;
  v_group_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Security: verify ALL stock items belong to a group the caller is a member of.
  -- Without this check, a malicious client could pass arbitrary UUIDs and bypass RLS
  -- because SECURITY DEFINER runs with elevated privileges.
  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT group_id INTO v_group_id FROM public.stock_items WHERE id = v_item_id;
    IF v_group_id IS NULL THEN
      RAISE EXCEPTION 'Item de estoque não encontrado: %', v_item_id;
    END IF;
    IF NOT public.is_group_member(v_group_id) THEN
      RAISE EXCEPTION 'Sem permissão para item de estoque %', v_item_id;
    END IF;
  END LOOP;

  FOREACH v_item_id IN ARRAY p_item_ids LOOP
    SELECT product_id INTO v_product_id FROM public.stock_items WHERE id = v_item_id;

    IF p_nao_aplica THEN
      UPDATE public.stock_items
      SET validade_nao_aplica = true,
          data_validade_alerta = NULL,
          data_validade = NULL
      WHERE id = v_item_id;

      IF v_product_id IS NOT NULL THEN
        UPDATE public.product_catalog SET perecivel = false WHERE id = v_product_id;
      END IF;
    ELSE
      -- Keep data_validade in sync with data_validade_alerta to avoid divergence
      -- between "the alert date" and "the actual stored expiration date".
      UPDATE public.stock_items
      SET data_validade_alerta = p_data_validade,
          data_validade = p_data_validade,
          validade_nao_aplica = false
      WHERE id = v_item_id;
    END IF;

    -- Record an informational movement. quantidade = 0 because this is a metadata
    -- adjustment (validity), not a stock change. Using quantidade_atual would inflate
    -- consumption / movement reports.
    INSERT INTO public.stock_movements (
      item_id, stock_item_id, tipo, quantidade, unidade, observacao, origem, criado_por
    )
    SELECT id, id, 'ajuste_validade_bulk', 0, unidade,
           CASE WHEN p_nao_aplica
             THEN 'Marcado como não perecível (bulk)'
             ELSE 'Ajuste de validade em lote: ' || p_data_validade::text
           END,
           'adjustment', v_user_id
    FROM public.stock_items WHERE id = v_item_id;
  END LOOP;
END;
$$;

COMMIT;
