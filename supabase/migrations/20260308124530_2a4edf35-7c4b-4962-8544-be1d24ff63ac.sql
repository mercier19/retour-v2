
CREATE OR REPLACE FUNCTION public.search_parcels_global(p_search text)
RETURNS TABLE(
  id uuid,
  tracking text,
  boutique text,
  status text,
  is_missing boolean,
  is_multi_part boolean,
  part_number integer,
  total_parts integer,
  box_name text,
  warehouse_name text,
  transfer_status text,
  destination_warehouse_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.tracking,
    p.boutique,
    p.status,
    p.is_missing,
    p.is_multi_part,
    p.part_number,
    p.total_parts,
    b.name AS box_name,
    w.name AS warehouse_name,
    p.transfer_status,
    dw.name AS destination_warehouse_name
  FROM public.parcels p
  LEFT JOIN public.boxes b ON b.id = p.box_id
  LEFT JOIN public.warehouses w ON w.id = p.warehouse_id
  LEFT JOIN public.warehouses dw ON dw.id = p.destination_warehouse_id
  WHERE p.tracking ILIKE '%' || p_search || '%'
     OR p.boutique ILIKE '%' || p_search || '%'
  ORDER BY p.tracking, p.part_number
  LIMIT 50;
END;
$$;
