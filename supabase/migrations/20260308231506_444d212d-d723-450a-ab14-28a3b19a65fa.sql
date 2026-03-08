
CREATE OR REPLACE FUNCTION public.warehouse_stats(p_warehouse_ids uuid[], p_start_date timestamptz DEFAULT NULL, p_end_date timestamptz DEFAULT NULL)
RETURNS TABLE(
  warehouse_id uuid,
  warehouse_name text,
  warehouse_type text,
  received bigint,
  given bigint,
  missing bigint,
  in_transit bigint,
  misrouted bigint,
  active_in_stock bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    w.id AS warehouse_id,
    w.name AS warehouse_name,
    w.type AS warehouse_type,
    COUNT(p.id)::bigint AS received,
    COUNT(CASE WHEN p.status = 'given' OR p.given_at IS NOT NULL THEN 1 END)::bigint AS given,
    COUNT(CASE WHEN p.is_missing = true AND p.status != 'given' THEN 1 END)::bigint AS missing,
    COUNT(CASE WHEN p.transfer_status = 'in_transit' THEN 1 END)::bigint AS in_transit,
    COUNT(CASE WHEN p.transfer_status = 'misrouted' THEN 1 END)::bigint AS misrouted,
    COUNT(CASE WHEN p.status != 'given' AND p.status != 'cancelled' AND (p.given_at IS NULL) THEN 1 END)::bigint AS active_in_stock
  FROM public.warehouses w
  LEFT JOIN public.parcels p ON p.warehouse_id = w.id
    AND (p_start_date IS NULL OR p.created_at >= p_start_date)
    AND (p_end_date IS NULL OR p.created_at <= p_end_date)
  WHERE w.id = ANY(p_warehouse_ids)
  GROUP BY w.id, w.name, w.type
  ORDER BY COUNT(p.id) DESC;
END;
$$;
