
-- Fix 1: Prevent privilege escalation via profile role self-update
DROP POLICY "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_super_admin())
  WITH CHECK (
    is_super_admin() OR
    (id = auth.uid() AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid()))
  );

-- Fix 2: Change parcels public SELECT policy to authenticated only
DROP POLICY "Users can see in_transit parcels destined to their warehouse" ON public.parcels;
CREATE POLICY "Users can see in_transit parcels destined to their warehouse" ON public.parcels
  FOR SELECT TO authenticated
  USING (transfer_status = 'in_transit' AND destination_warehouse_id IN (SELECT user_warehouse_ids()));

-- Fix 3: Restrict boutique_mappings INSERT and UPDATE to appropriate roles
DROP POLICY "All authenticated can insert boutique mappings" ON public.boutique_mappings;
CREATE POLICY "Authorized roles can insert boutique mappings" ON public.boutique_mappings
  FOR INSERT TO authenticated
  WITH CHECK (user_role() = ANY (ARRAY['chef_agence'::app_role, 'regional'::app_role, 'super_admin'::app_role]));

DROP POLICY "All authenticated can update boutique mappings" ON public.boutique_mappings;
CREATE POLICY "Authorized roles can update boutique mappings" ON public.boutique_mappings
  FOR UPDATE TO authenticated
  USING (user_role() = ANY (ARRAY['chef_agence'::app_role, 'regional'::app_role, 'super_admin'::app_role]))
  WITH CHECK (user_role() = ANY (ARRAY['chef_agence'::app_role, 'regional'::app_role, 'super_admin'::app_role]));
