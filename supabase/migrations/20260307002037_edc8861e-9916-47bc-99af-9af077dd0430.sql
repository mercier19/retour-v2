
-- Add multi-part columns to parcels
ALTER TABLE public.parcels 
  ADD COLUMN is_multi_part boolean NOT NULL DEFAULT false,
  ADD COLUMN part_number integer NOT NULL DEFAULT 1,
  ADD COLUMN total_parts integer NOT NULL DEFAULT 1;

-- Add multi-part columns to archived_parcels
ALTER TABLE public.archived_parcels 
  ADD COLUMN is_multi_part boolean NOT NULL DEFAULT false,
  ADD COLUMN part_number integer NOT NULL DEFAULT 1,
  ADD COLUMN total_parts integer NOT NULL DEFAULT 1;

-- Drop old unique constraint and add new one
ALTER TABLE public.parcels DROP CONSTRAINT IF EXISTS parcels_warehouse_id_tracking_key;
ALTER TABLE public.parcels ADD CONSTRAINT parcels_tracking_part_unique UNIQUE (warehouse_id, tracking, part_number);
