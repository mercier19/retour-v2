
-- Fix search_path on validation functions
CREATE OR REPLACE FUNCTION public.validate_transfer_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.transfer_status NOT IN ('in_stock', 'in_transit', 'misrouted') THEN
    RAISE EXCEPTION 'Invalid transfer_status: %', NEW.transfer_status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_transfer_history_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'misrouted') THEN
    RAISE EXCEPTION 'Invalid transfer_history status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;
