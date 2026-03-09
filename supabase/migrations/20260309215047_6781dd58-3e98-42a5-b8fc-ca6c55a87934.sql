
CREATE OR REPLACE FUNCTION public.resolve_misrouted_parcel(
  p_parcel_id uuid,
  p_current_warehouse_id uuid,
  p_box_id uuid,
  p_accept_in_current boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_dest_wh UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_warehouse_ids() uw WHERE uw = p_current_warehouse_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized warehouse access';
  END IF;

  SELECT destination_warehouse_id INTO v_dest_wh
  FROM public.parcels
  WHERE id = p_parcel_id;

  IF p_accept_in_current THEN
    UPDATE public.parcels
    SET
      warehouse_id = p_current_warehouse_id,
      status = 'in_stock',
      transfer_status = 'in_stock',
      destination_warehouse_id = NULL,
      misrouted_at_warehouse_id = NULL,
      box_id = p_box_id,
      transfer_completed_at = now()
    WHERE id = p_parcel_id;

    UPDATE public.transfer_history
    SET status = 'completed', completed_at = now()
    WHERE parcel_id = p_parcel_id AND status = 'misrouted'
    AND id = (
      SELECT th.id FROM public.transfer_history th
      WHERE th.parcel_id = p_parcel_id AND th.status = 'misrouted'
      ORDER BY th.initiated_at DESC LIMIT 1
    );
  ELSE
    UPDATE public.parcels
    SET
      transfer_status = 'in_transit',
      destination_warehouse_id = v_dest_wh,
      misrouted_at_warehouse_id = NULL,
      box_id = NULL,
      transfer_completed_at = NULL
    WHERE id = p_parcel_id;

    INSERT INTO public.transfer_history (
      parcel_id, from_warehouse_id, to_warehouse_id,
      initiated_by, initiated_at, status
    ) VALUES (
      p_parcel_id,
      p_current_warehouse_id,
      v_dest_wh,
      auth.uid(),
      now(),
      'pending'
    );
  END IF;
END;
$$;
