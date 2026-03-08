
CREATE TABLE public.boutique_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  external_id integer NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.boutique_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view boutique mappings"
  ON public.boutique_mappings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert boutique mappings"
  ON public.boutique_mappings FOR INSERT
  TO authenticated
  WITH CHECK (user_role() IN ('chef_agence', 'regional', 'super_admin'));

CREATE POLICY "Admins can update boutique mappings"
  ON public.boutique_mappings FOR UPDATE
  TO authenticated
  USING (user_role() IN ('chef_agence', 'regional', 'super_admin'));

CREATE POLICY "Admins can delete boutique mappings"
  ON public.boutique_mappings FOR DELETE
  TO authenticated
  USING (user_role() IN ('chef_agence', 'regional', 'super_admin'));
