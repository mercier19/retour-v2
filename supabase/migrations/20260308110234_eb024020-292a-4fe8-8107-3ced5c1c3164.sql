CREATE POLICY "Users can see in_transit parcels destined to their warehouse"
  ON public.parcels FOR SELECT
  USING (
    transfer_status = 'in_transit'
    AND destination_warehouse_id IN (SELECT user_warehouse_ids())
  );