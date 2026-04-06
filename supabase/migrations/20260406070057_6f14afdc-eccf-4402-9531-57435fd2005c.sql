
-- 1. Trigger to uppercase tracking on parcels
CREATE OR REPLACE FUNCTION public.uppercase_tracking()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.tracking := UPPER(NEW.tracking);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_uppercase_tracking
BEFORE INSERT OR UPDATE OF tracking ON public.parcels
FOR EACH ROW
EXECUTE FUNCTION public.uppercase_tracking();

-- 2. Update check_overdue_inventories: 24h → 4h
CREATE OR REPLACE FUNCTION public.check_overdue_inventories()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.scheduled_inventories SET status = 'overdue'
  WHERE status = 'pending' AND scheduled_date < NOW();

  INSERT INTO public.inventory_notifications (warehouse_id, user_id, type, message)
  SELECT si.warehouse_id, uw.user_id,
    CASE WHEN si.scheduled_date < NOW() - INTERVAL '4 hours' THEN 'overdue' ELSE 'warning' END,
    format('Inventaire du %s est en retard.', to_char(si.scheduled_date, 'DD/MM/YYYY HH24:MI'))
  FROM public.scheduled_inventories si
  JOIN public.user_warehouses uw ON si.warehouse_id = uw.warehouse_id
  JOIN public.profiles p ON uw.user_id = p.id
  WHERE si.status = 'overdue'
    AND (
      (si.scheduled_date >= NOW() - INTERVAL '4 hours' AND p.role IN ('chef_agence', 'operations'))
      OR (si.scheduled_date < NOW() - INTERVAL '4 hours' AND p.role = 'regional')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_notifications n
      WHERE n.warehouse_id = si.warehouse_id
        AND n.user_id = uw.user_id
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$;
