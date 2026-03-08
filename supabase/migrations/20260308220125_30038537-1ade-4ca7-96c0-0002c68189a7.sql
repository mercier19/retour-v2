
DROP POLICY IF EXISTS "Admins can update boutique mappings" ON public.boutique_mappings;
CREATE POLICY "All authenticated can update boutique mappings"
  ON public.boutique_mappings FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
