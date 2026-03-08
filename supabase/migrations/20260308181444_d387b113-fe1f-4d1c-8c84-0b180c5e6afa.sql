ALTER TABLE public.parcels ADD COLUMN delivery_type text DEFAULT 'SD';
ALTER TABLE public.archived_parcels ADD COLUMN delivery_type text DEFAULT 'SD';