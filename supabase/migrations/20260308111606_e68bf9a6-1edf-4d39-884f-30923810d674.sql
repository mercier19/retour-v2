-- RPC: récupérer un colis en transit destiné à un dépôt de l'utilisateur
CREATE OR REPLACE FUNCTION public.get_incoming_transfer(
  p_tracking TEXT,
  p_destination_warehouse_id UUID
)
RETURNS TABLE (
  id UUID,
  tracking TEXT,
  warehouse_id UUID,
  destination_warehouse_id UUID,
  transfer_status TEXT,
  boutique TEXT,
  wilaya TEXT,
  commune TEXT,
  phone TEXT,
  is_multi_part BOOLEAN,
  part_number INTEGER,
  total_parts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_warehouse_ids() uw
    WHERE uw = p_destination_warehouse_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized warehouse access';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.tracking,
    p.warehouse_id,
    p.destination_warehouse_id,
    p.transfer_status,
    p.boutique,
    p.wilaya,
    p.commune,
    p.phone,
    p.is_multi_part,
    p.part_number,
    p.total_parts
  FROM public.parcels p
  WHERE p.tracking = p_tracking
    AND p.transfer_status = 'in_transit'
    AND p.destination_warehouse_id = p_destination_warehouse_id
  ORDER BY p.updated_at DESC
  LIMIT 1;
END;
$$;

-- RPC: marquer un colis entrant comme reçu
CREATE OR REPLACE FUNCTION public.receive_incoming_transfer(
  p_parcel_id UUID,
  p_new_warehouse_id UUID,
  p_box_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_warehouse_ids() uw
    WHERE uw = p_new_warehouse_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized warehouse access';
  END IF;

  UPDATE public.parcels
  SET
    warehouse_id = p_new_warehouse_id,
    transfer_status = 'in_stock',
    transfer_completed_at = now(),
    destination_warehouse_id = NULL,
    box_id = p_box_id
  WHERE id = p_parcel_id
    AND transfer_status = 'in_transit'
    AND destination_warehouse_id = p_new_warehouse_id
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NULL THEN
    RAISE EXCEPTION 'Transfer not found or not receivable';
  END IF;

  UPDATE public.transfer_history
  SET
    completed_at = now(),
    status = 'completed'
  WHERE id = (
    SELECT th.id
    FROM public.transfer_history th
    WHERE th.parcel_id = p_parcel_id
      AND th.status = 'pending'
    ORDER BY th.initiated_at DESC
    LIMIT 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_incoming_transfer(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.receive_incoming_transfer(UUID, UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_incoming_transfer(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_incoming_transfer(UUID, UUID, UUID) TO authenticated;