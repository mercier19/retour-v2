
-- 1. Fix profiles INSERT policy: restrict non-admin self-insert to 'operations' role only
DROP POLICY IF EXISTS "Super admin can insert profiles" ON public.profiles;
CREATE POLICY "Super admin can insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin()
    OR (
      id = auth.uid()
      AND role = 'operations'
    )
  );

-- 2. Fix audit attribution fields in RLS policies

-- 2a. parcel_status_log: bind changed_by to auth.uid()
DROP POLICY IF EXISTS "Users can insert parcel logs" ON public.parcel_status_log;
CREATE POLICY "Users can insert parcel logs"
  ON public.parcel_status_log FOR INSERT
  TO authenticated
  WITH CHECK (
    (changed_by IS NULL OR changed_by = auth.uid())
    AND parcel_id IN (
      SELECT p.id FROM parcels p
      WHERE p.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

-- 2b. transfer_history: bind initiated_by to auth.uid()
DROP POLICY IF EXISTS "Chef and above can insert transfers" ON public.transfer_history;
CREATE POLICY "Chef and above can insert transfers"
  ON public.transfer_history FOR INSERT
  TO authenticated
  WITH CHECK (
    (initiated_by IS NULL OR initiated_by = auth.uid())
    AND from_warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() = ANY(ARRAY['chef_agence'::app_role, 'regional'::app_role, 'super_admin'::app_role])
  );

-- 2c. inventory_checks: bind checked_by to auth.uid()
DROP POLICY IF EXISTS "Staff can insert inventory checks" ON public.inventory_checks;
CREATE POLICY "Staff can insert inventory checks"
  ON public.inventory_checks FOR INSERT
  TO authenticated
  WITH CHECK (
    (checked_by IS NULL OR checked_by = auth.uid())
    AND EXISTS (
      SELECT 1 FROM inventory_sessions s
      WHERE s.id = inventory_checks.inventory_session_id
        AND s.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

-- 2d. inventory_sessions: bind completed_by to auth.uid() on UPDATE
DROP POLICY IF EXISTS "Staff can update inventory sessions" ON public.inventory_sessions;
CREATE POLICY "Staff can update inventory sessions"
  ON public.inventory_sessions FOR UPDATE
  TO authenticated
  USING (
    warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() = ANY(ARRAY['chef_agence'::app_role, 'operations'::app_role, 'super_admin'::app_role])
  )
  WITH CHECK (
    (completed_by IS NULL OR completed_by = auth.uid())
    AND warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() = ANY(ARRAY['chef_agence'::app_role, 'operations'::app_role, 'super_admin'::app_role])
  );

-- 2e. scheduled_inventories: bind created_by to auth.uid()
DROP POLICY IF EXISTS "Regional/super_admin can insert scheduled inventories" ON public.scheduled_inventories;
CREATE POLICY "Regional/super_admin can insert scheduled inventories"
  ON public.scheduled_inventories FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by IS NULL OR created_by = auth.uid())
    AND user_role() = ANY(ARRAY['regional'::app_role, 'super_admin'::app_role])
    AND warehouse_id IN (SELECT user_warehouse_ids())
  );

-- 2f. parcels: bind added_by to auth.uid()
DROP POLICY IF EXISTS "Users can insert parcels in their warehouses" ON public.parcels;
CREATE POLICY "Users can insert parcels in their warehouses"
  ON public.parcels FOR INSERT
  TO authenticated
  WITH CHECK (
    (added_by IS NULL OR added_by = auth.uid())
    AND warehouse_id IN (SELECT user_warehouse_ids())
  );
