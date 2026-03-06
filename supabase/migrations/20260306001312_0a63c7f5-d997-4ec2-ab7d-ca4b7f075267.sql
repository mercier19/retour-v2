
-- Add phone column to parcels
ALTER TABLE public.parcels ADD COLUMN IF NOT EXISTS phone text;

-- Add phone column to archived_parcels
ALTER TABLE public.archived_parcels ADD COLUMN IF NOT EXISTS phone text;

-- Add warehouse_id to parcel_status_log to track location
ALTER TABLE public.parcel_status_log ADD COLUMN IF NOT EXISTS warehouse_id uuid REFERENCES public.warehouses(id);

-- Update the trigger function to also capture warehouse_id
CREATE OR REPLACE FUNCTION public.log_parcel_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.parcel_status_log (parcel_id, status, changed_by, warehouse_id)
    VALUES (NEW.id, COALESCE(NEW.status, 'in_stock'), NEW.added_by, NEW.warehouse_id);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.parcel_status_log (parcel_id, status, changed_by, warehouse_id)
    VALUES (NEW.id, NEW.status, auth.uid(), NEW.warehouse_id);
  END IF;
  RETURN NEW;
END;
$function$;
