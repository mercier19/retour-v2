
CREATE OR REPLACE FUNCTION public.log_parcel_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.parcel_status_log (parcel_id, status, changed_by, warehouse_id)
    VALUES (NEW.id, COALESCE(NEW.status, 'in_stock'), NEW.added_by, NEW.warehouse_id);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Log status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO public.parcel_status_log (parcel_id, status, changed_by, warehouse_id)
      VALUES (NEW.id, NEW.status, auth.uid(), NEW.warehouse_id);
    END IF;
    -- Log is_missing changes (missing/found)
    IF OLD.is_missing IS DISTINCT FROM NEW.is_missing THEN
      INSERT INTO public.parcel_status_log (parcel_id, status, changed_by, warehouse_id)
      VALUES (NEW.id, CASE WHEN NEW.is_missing THEN 'missing' ELSE 'found' END, auth.uid(), NEW.warehouse_id);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
