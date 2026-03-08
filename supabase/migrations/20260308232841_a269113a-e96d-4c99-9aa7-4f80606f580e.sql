
CREATE TABLE public.user_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  action_type text NOT NULL,
  parcel_id uuid REFERENCES public.parcels(id) ON DELETE SET NULL,
  action_data jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_actions_user_id ON public.user_actions(user_id);
CREATE INDEX idx_user_actions_warehouse_id ON public.user_actions(warehouse_id);
CREATE INDEX idx_user_actions_created_at ON public.user_actions(created_at);
CREATE INDEX idx_user_actions_action_type ON public.user_actions(action_type);

ALTER TABLE public.user_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view actions in their warehouses"
  ON public.user_actions FOR SELECT
  TO authenticated
  USING (
    warehouse_id IN (SELECT user_warehouse_ids())
  );

CREATE POLICY "Authenticated users can insert actions"
  ON public.user_actions FOR INSERT
  TO authenticated
  WITH CHECK (true);
