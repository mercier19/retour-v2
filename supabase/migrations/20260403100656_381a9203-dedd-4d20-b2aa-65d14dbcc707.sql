
-- =============================================
-- SCHEDULED INVENTORIES
-- =============================================
CREATE TABLE public.scheduled_inventories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  scheduled_date TIMESTAMPTZ NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  status TEXT NOT NULL DEFAULT 'pending',
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  interval_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheduled_inventories ENABLE ROW LEVEL SECURITY;

-- Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_scheduled_inventory_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'overdue', 'cancelled') THEN
    RAISE EXCEPTION 'Invalid scheduled_inventory status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_scheduled_inventory_status
  BEFORE INSERT OR UPDATE ON public.scheduled_inventories
  FOR EACH ROW EXECUTE FUNCTION public.validate_scheduled_inventory_status();

-- RLS
CREATE POLICY "Users can view scheduled inventories of their warehouses"
  ON public.scheduled_inventories FOR SELECT TO authenticated
  USING (warehouse_id IN (SELECT user_warehouse_ids()));

CREATE POLICY "Regional/super_admin can insert scheduled inventories"
  ON public.scheduled_inventories FOR INSERT TO authenticated
  WITH CHECK (user_role() IN ('regional', 'super_admin') AND warehouse_id IN (SELECT user_warehouse_ids()));

CREATE POLICY "Regional/super_admin can update scheduled inventories"
  ON public.scheduled_inventories FOR UPDATE TO authenticated
  USING (user_role() IN ('regional', 'super_admin') AND warehouse_id IN (SELECT user_warehouse_ids()));

CREATE POLICY "Regional/super_admin can delete scheduled inventories"
  ON public.scheduled_inventories FOR DELETE TO authenticated
  USING (user_role() IN ('regional', 'super_admin') AND warehouse_id IN (SELECT user_warehouse_ids()));

CREATE INDEX idx_scheduled_inventories_warehouse ON public.scheduled_inventories(warehouse_id);

-- =============================================
-- INVENTORY SESSIONS
-- =============================================
CREATE TABLE public.inventory_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheduled_inventory_id UUID REFERENCES public.scheduled_inventories(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES public.profiles(id),
  notes TEXT
);

ALTER TABLE public.inventory_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory sessions of their warehouses"
  ON public.inventory_sessions FOR SELECT TO authenticated
  USING (warehouse_id IN (SELECT user_warehouse_ids()));

CREATE POLICY "Staff can insert inventory sessions"
  ON public.inventory_sessions FOR INSERT TO authenticated
  WITH CHECK (
    warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() IN ('chef_agence', 'operations', 'super_admin')
  );

CREATE POLICY "Staff can update inventory sessions"
  ON public.inventory_sessions FOR UPDATE TO authenticated
  USING (
    warehouse_id IN (SELECT user_warehouse_ids())
    AND user_role() IN ('chef_agence', 'operations', 'super_admin')
  );

CREATE INDEX idx_inventory_sessions_warehouse ON public.inventory_sessions(warehouse_id);

-- =============================================
-- INVENTORY CHECKS
-- =============================================
CREATE TABLE public.inventory_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_session_id UUID NOT NULL REFERENCES public.inventory_sessions(id),
  box_id UUID NOT NULL REFERENCES public.boxes(id),
  expected_count INTEGER NOT NULL DEFAULT 0,
  actual_count INTEGER DEFAULT 0,
  discrepancies JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_by UUID REFERENCES public.profiles(id)
);

ALTER TABLE public.inventory_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory checks via session"
  ON public.inventory_checks FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inventory_sessions s
      WHERE s.id = inventory_session_id
      AND s.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

CREATE POLICY "Staff can insert inventory checks"
  ON public.inventory_checks FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inventory_sessions s
      WHERE s.id = inventory_session_id
      AND s.warehouse_id IN (SELECT user_warehouse_ids())
    )
  );

CREATE INDEX idx_inventory_checks_session ON public.inventory_checks(inventory_session_id);

-- =============================================
-- INVENTORY NOTIFICATIONS
-- =============================================
CREATE TABLE public.inventory_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  warehouse_id UUID REFERENCES public.warehouses(id),
  user_id UUID REFERENCES public.profiles(id),
  type TEXT NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.inventory_notifications ENABLE ROW LEVEL SECURITY;

-- Validation trigger for type
CREATE OR REPLACE FUNCTION public.validate_inventory_notification_type()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.type NOT IN ('warning', 'overdue', 'reminder') THEN
    RAISE EXCEPTION 'Invalid inventory_notification type: %', NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_inventory_notification_type
  BEFORE INSERT OR UPDATE ON public.inventory_notifications
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_notification_type();

CREATE POLICY "Users see own notifications"
  ON public.inventory_notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR user_role() = 'super_admin');

CREATE POLICY "Users can update own notifications"
  ON public.inventory_notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX idx_inventory_notifications_user ON public.inventory_notifications(user_id);

-- =============================================
-- RECURRING INVENTORY TRIGGER
-- =============================================
CREATE OR REPLACE FUNCTION public.create_next_recurring_inventory()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  parent_inv public.scheduled_inventories%ROWTYPE;
  next_date TIMESTAMPTZ;
BEGIN
  IF NEW.scheduled_inventory_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT * INTO parent_inv
  FROM public.scheduled_inventories
  WHERE id = NEW.scheduled_inventory_id;

  IF parent_inv.is_recurring AND parent_inv.status != 'cancelled' THEN
    next_date := NEW.completed_at + (parent_inv.interval_days || ' days')::INTERVAL;
    INSERT INTO public.scheduled_inventories (warehouse_id, scheduled_date, created_by, is_recurring, interval_days)
    VALUES (parent_inv.warehouse_id, next_date, parent_inv.created_by, true, parent_inv.interval_days);

    UPDATE public.scheduled_inventories SET status = 'completed' WHERE id = parent_inv.id;
  ELSE
    UPDATE public.scheduled_inventories SET status = 'completed' WHERE id = parent_inv.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER after_inventory_session_completed
  AFTER UPDATE OF completed_at ON public.inventory_sessions
  FOR EACH ROW
  WHEN (NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL)
  EXECUTE FUNCTION public.create_next_recurring_inventory();

-- =============================================
-- CHECK OVERDUE RPC
-- =============================================
CREATE OR REPLACE FUNCTION public.check_overdue_inventories()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.scheduled_inventories SET status = 'overdue'
  WHERE status = 'pending' AND scheduled_date < NOW();

  INSERT INTO public.inventory_notifications (warehouse_id, user_id, type, message)
  SELECT si.warehouse_id, uw.user_id,
    CASE WHEN si.scheduled_date < NOW() - INTERVAL '24 hours' THEN 'overdue' ELSE 'warning' END,
    format('Inventaire du %s est en retard.', to_char(si.scheduled_date, 'DD/MM/YYYY HH24:MI'))
  FROM public.scheduled_inventories si
  JOIN public.user_warehouses uw ON si.warehouse_id = uw.warehouse_id
  JOIN public.profiles p ON uw.user_id = p.id
  WHERE si.status = 'overdue'
    AND (
      (si.scheduled_date >= NOW() - INTERVAL '24 hours' AND p.role IN ('chef_agence', 'operations'))
      OR (si.scheduled_date < NOW() - INTERVAL '24 hours' AND p.role = 'regional')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.inventory_notifications n
      WHERE n.warehouse_id = si.warehouse_id
        AND n.user_id = uw.user_id
        AND n.created_at > NOW() - INTERVAL '1 hour'
    );
END;
$$;
