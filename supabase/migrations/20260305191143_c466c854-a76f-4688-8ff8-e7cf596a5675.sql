CREATE OR REPLACE FUNCTION public.user_warehouse_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT uw.warehouse_id
  FROM public.user_warehouses uw
  WHERE uw.user_id = auth.uid()

  UNION

  SELECT w.id
  FROM public.warehouses w
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
  );
$$;