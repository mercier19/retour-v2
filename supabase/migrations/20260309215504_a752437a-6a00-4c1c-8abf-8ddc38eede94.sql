
CREATE OR REPLACE FUNCTION public.get_misrouted_parcels_at_warehouse(p_warehouse_ids uuid[])
RETURNS TABLE(id uuid, tracking text, destination_warehouse_id uuid, misrouted_at_warehouse_id uuid, boutique text, warehouse_id uuid)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT p.id, p.tracking, p.destination_warehouse_id, p.misrouted_at_warehouse_id, p.boutique, p.warehouse_id
  FROM public.parcels p
  WHERE p.transfer_status = 'misrouted'
    AND p.misrouted_at_warehouse_id = ANY(p_warehouse_ids);
END;
$$;
