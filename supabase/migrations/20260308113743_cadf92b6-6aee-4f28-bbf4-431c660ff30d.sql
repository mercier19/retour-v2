CREATE OR REPLACE FUNCTION public.is_parcel_given(
  p_tracking TEXT,
  p_warehouse_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_given BOOLEAN;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.user_warehouse_ids() uw
    WHERE uw = p_warehouse_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized warehouse access';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.parcels p
    WHERE p.tracking = p_tracking
      AND p.warehouse_id = p_warehouse_id
      AND (p.given_at IS NOT NULL OR p.status = 'given')
  )
  INTO v_given;

  RETURN v_given;
END;
$$;

REVOKE ALL ON FUNCTION public.is_parcel_given(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_parcel_given(TEXT, UUID) TO authenticated;