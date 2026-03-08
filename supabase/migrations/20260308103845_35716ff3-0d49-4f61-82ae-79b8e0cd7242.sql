
-- Add transfer columns to parcels
ALTER TABLE public.parcels 
  ADD COLUMN IF NOT EXISTS transfer_status TEXT DEFAULT 'in_stock',
  ADD COLUMN IF NOT EXISTS destination_warehouse_id UUID REFERENCES public.warehouses(id) NULL,
  ADD COLUMN IF NOT EXISTS transfer_initiated_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS transfer_completed_at TIMESTAMPTZ NULL;

-- Validation trigger for transfer_status
CREATE OR REPLACE FUNCTION public.validate_transfer_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.transfer_status NOT IN ('in_stock', 'in_transit', 'misrouted') THEN
    RAISE EXCEPTION 'Invalid transfer_status: %', NEW.transfer_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_parcels_transfer_status
  BEFORE INSERT OR UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_status();

-- Create transfer_history table
CREATE TABLE public.transfer_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parcel_id UUID NOT NULL REFERENCES public.parcels(id) ON DELETE CASCADE,
  from_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  to_warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  initiated_by UUID REFERENCES public.profiles(id),
  initiated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Validation trigger for transfer_history status
CREATE OR REPLACE FUNCTION public.validate_transfer_history_status()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'misrouted') THEN
    RAISE EXCEPTION 'Invalid transfer_history status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_transfer_history_status
  BEFORE INSERT OR UPDATE ON public.transfer_history
  FOR EACH ROW EXECUTE FUNCTION public.validate_transfer_history_status();

-- Enable RLS
ALTER TABLE public.transfer_history ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view transfers involving their warehouses
CREATE POLICY "Users can view their warehouse transfers"
  ON public.transfer_history FOR SELECT
  TO authenticated
  USING (
    from_warehouse_id IN (SELECT user_warehouse_ids())
    OR to_warehouse_id IN (SELECT user_warehouse_ids())
  );

-- RLS: Chef and above can insert transfers from their warehouse
CREATE POLICY "Chef and above can insert transfers"
  ON public.transfer_history FOR INSERT
  TO authenticated
  WITH CHECK (
    from_warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() IN ('chef_agence', 'regional', 'super_admin')
  );

-- RLS: Users can update transfers for their warehouses
CREATE POLICY "Users can update transfers in their warehouses"
  ON public.transfer_history FOR UPDATE
  TO authenticated
  USING (
    to_warehouse_id IN (SELECT user_warehouse_ids())
    OR from_warehouse_id IN (SELECT user_warehouse_ids())
  );
