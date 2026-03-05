
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('operations', 'chef_agence', 'regional', 'super_admin');

-- Create warehouses table
CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'agence',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  role app_role NOT NULL DEFAULT 'operations',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_warehouses junction table
CREATE TABLE public.user_warehouses (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, warehouse_id)
);

-- Create boxes table
CREATE TABLE public.boxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quota INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, name)
);

-- Create parcels table
CREATE TABLE public.parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  tracking TEXT NOT NULL,
  box_id UUID REFERENCES public.boxes(id) ON DELETE SET NULL,
  boutique TEXT,
  wilaya TEXT,
  commune TEXT,
  status TEXT DEFAULT 'in_stock',
  is_missing BOOLEAN DEFAULT false,
  given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(warehouse_id, tracking)
);

-- Create archived_parcels table
CREATE TABLE public.archived_parcels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  tracking TEXT NOT NULL,
  box_name TEXT,
  boutique TEXT,
  wilaya TEXT,
  commune TEXT,
  status TEXT,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_parcels_warehouse ON public.parcels(warehouse_id);
CREATE INDEX idx_parcels_box ON public.parcels(box_id);
CREATE INDEX idx_parcels_tracking ON public.parcels(tracking);
CREATE INDEX idx_boxes_warehouse ON public.boxes(warehouse_id);
CREATE INDEX idx_archived_parcels_warehouse ON public.archived_parcels(warehouse_id);

-- Enable RLS on all tables
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_parcels ENABLE ROW LEVEL SECURITY;

-- Helper function: get user role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- Helper function: check if super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
  )
$$;

-- Helper function: get user warehouse IDs
CREATE OR REPLACE FUNCTION public.user_warehouse_ids()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
    THEN (SELECT id FROM public.warehouses)
    ELSE (SELECT warehouse_id FROM public.user_warehouses WHERE user_id = auth.uid())
  END
$$;

-- Helper function: setup super admin
CREATE OR REPLACE FUNCTION public.setup_super_admin(_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (_user_id, 'super_admin')
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin';
END;
$$;

-- Trigger: auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_parcels_updated_at
  BEFORE UPDATE ON public.parcels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies: warehouses
CREATE POLICY "Authenticated users can view warehouses" ON public.warehouses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Super admin can insert warehouses" ON public.warehouses FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin can update warehouses" ON public.warehouses FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admin can delete warehouses" ON public.warehouses FOR DELETE TO authenticated USING (public.is_super_admin());

-- RLS Policies: profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin can insert profiles" ON public.profiles FOR INSERT TO authenticated WITH CHECK (public.is_super_admin() OR id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin can delete profiles" ON public.profiles FOR DELETE TO authenticated USING (public.is_super_admin());

-- RLS Policies: user_warehouses
CREATE POLICY "Users can view own warehouse assignments" ON public.user_warehouses FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_super_admin());
CREATE POLICY "Super admin can manage warehouse assignments" ON public.user_warehouses FOR INSERT TO authenticated WITH CHECK (public.is_super_admin());
CREATE POLICY "Super admin can update warehouse assignments" ON public.user_warehouses FOR UPDATE TO authenticated USING (public.is_super_admin());
CREATE POLICY "Super admin can delete warehouse assignments" ON public.user_warehouses FOR DELETE TO authenticated USING (public.is_super_admin());

-- RLS Policies: boxes
CREATE POLICY "Users can view boxes in their warehouses" ON public.boxes FOR SELECT TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Chef and above can insert boxes" ON public.boxes FOR INSERT TO authenticated WITH CHECK (warehouse_id IN (SELECT public.user_warehouse_ids()) AND public.user_role() IN ('chef_agence', 'regional', 'super_admin'));
CREATE POLICY "Chef and above can update boxes" ON public.boxes FOR UPDATE TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()) AND public.user_role() IN ('chef_agence', 'regional', 'super_admin'));
CREATE POLICY "Chef and above can delete boxes" ON public.boxes FOR DELETE TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()) AND public.user_role() IN ('chef_agence', 'regional', 'super_admin'));

-- RLS Policies: parcels
CREATE POLICY "Users can view parcels in their warehouses" ON public.parcels FOR SELECT TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Users can insert parcels in their warehouses" ON public.parcels FOR INSERT TO authenticated WITH CHECK (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Users can update parcels in their warehouses" ON public.parcels FOR UPDATE TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Chef and above can delete parcels" ON public.parcels FOR DELETE TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()) AND public.user_role() IN ('chef_agence', 'regional', 'super_admin'));

-- RLS Policies: archived_parcels
CREATE POLICY "Users can view archived parcels in their warehouses" ON public.archived_parcels FOR SELECT TO authenticated USING (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Users can insert archived parcels" ON public.archived_parcels FOR INSERT TO authenticated WITH CHECK (warehouse_id IN (SELECT public.user_warehouse_ids()));
CREATE POLICY "Super admin can delete archived parcels" ON public.archived_parcels FOR DELETE TO authenticated USING (public.is_super_admin());

-- Seed warehouses
INSERT INTO public.warehouses (code, name, type) VALUES
  ('CT-ALG', 'Centre de Tri Alger', 'centre_tri'),
  ('CT-ORA', 'Centre de Tri Oran', 'centre_tri'),
  ('CT-CON', 'Centre de Tri Constantine', 'centre_tri'),
  ('AG-BLI', 'Agence Blida', 'agence'),
  ('AG-SET', 'Agence Sétif', 'agence'),
  ('AG-TLM', 'Agence Tlemcen', 'agence'),
  ('AG-BAT', 'Agence Batna', 'agence'),
  ('AG-BEJ', 'Agence Béjaïa', 'agence'),
  ('AG-ANB', 'Agence Annaba', 'agence'),
  ('DK-ALG', 'Desk Alger Centre', 'desk'),
  ('DK-HYD', 'Desk Hydra', 'desk'),
  ('DK-BAB', 'Desk Bab Ezzouar', 'desk'),
  ('DK-ORA', 'Desk Oran Centre', 'desk'),
  ('DK-CON', 'Desk Constantine Centre', 'desk');
