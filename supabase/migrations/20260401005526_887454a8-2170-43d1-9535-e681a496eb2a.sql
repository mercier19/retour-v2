
DROP POLICY "Authenticated users can insert actions" ON public.user_actions;

CREATE POLICY "Users can insert own actions" ON public.user_actions
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND warehouse_id IN (SELECT user_warehouse_ids())
  );
