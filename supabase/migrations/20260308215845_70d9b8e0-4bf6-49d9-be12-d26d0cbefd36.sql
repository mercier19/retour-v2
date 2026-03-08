
DROP POLICY IF EXISTS "Admins can insert boutique mappings" ON public.boutique_mappings;
CREATE POLICY "All authenticated can insert boutique mappings"
  ON public.boutique_mappings FOR INSERT
  TO authenticated
  WITH CHECK (true);
