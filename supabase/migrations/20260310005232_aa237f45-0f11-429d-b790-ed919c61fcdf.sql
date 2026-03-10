
-- Re-create the trigger that logs parcel status changes including missing/found
DROP TRIGGER IF EXISTS on_parcel_status_change ON public.parcels;
DROP TRIGGER IF EXISTS log_parcel_status_trigger ON public.parcels;

CREATE TRIGGER log_parcel_status_trigger
  AFTER INSERT OR UPDATE ON public.parcels
  FOR EACH ROW
  EXECUTE FUNCTION public.log_parcel_status();
