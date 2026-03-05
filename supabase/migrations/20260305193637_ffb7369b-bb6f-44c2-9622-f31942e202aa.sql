
-- Create parcel status log table
CREATE TABLE public.parcel_status_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parcel_id uuid NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.parcel_status_log ENABLE ROW LEVEL SECURITY;

-- RLS: users can view logs for parcels in their warehouses
CREATE POLICY "Users can view parcel logs in their warehouses"
  ON public.parcel_status_log
  FOR SELECT
  TO authenticated
  USING (
    parcel_id IN (
      SELECT p.id FROM public.parcels p
      WHERE p.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

-- RLS: users can insert logs for parcels in their warehouses
CREATE POLICY "Users can insert parcel logs"
  ON public.parcel_status_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    parcel_id IN (
      SELECT p.id FROM public.parcels p
      WHERE p.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

-- Trigger to auto-log status changes
CREATE OR REPLACE FUNCTION public.log_parcel_status_change()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.parcel_status_log (parcel_id, status, changed_by)
    VALUES (NEW.id, COALESCE(NEW.status, 'in_stock'), NEW.added_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.parcel_status_log (parcel_id, status, changed_by)
    VALUES (NEW.id, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER parcel_status_change_trigger
  AFTER INSERT OR UPDATE ON public.parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.log_parcel_status_change();
