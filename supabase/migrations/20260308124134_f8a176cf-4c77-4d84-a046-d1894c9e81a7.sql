
CREATE OR REPLACE FUNCTION public.receive_incoming_transfer(p_parcel_id uuid, p_new_warehouse_id uuid, p_box_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    status = 'in_stock',
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
$function$;
