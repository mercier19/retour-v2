

## Inventory Management System

### Overview
Add a full inventory system: regional users schedule inventories (one-time or recurring), warehouse staff execute them by scanning parcels box-by-box, and reports show discrepancies.

---

### Phase 1 — Database Migration (1 migration)

**4 new tables** (all using UUID PKs, consistent with existing schema):

- **`scheduled_inventories`** — warehouse_id, scheduled_date, created_by, status (pending/completed/overdue/cancelled), is_recurring, interval_days
- **`inventory_sessions`** — links to scheduled_inventory, warehouse_id, started_at, completed_at, completed_by, notes
- **`inventory_checks`** — per-box results: session FK, box_id (UUID), expected_count, actual_count, discrepancies (JSONB: `{missing: [...], extra: [...]}`)
- **`inventory_notifications`** — user_id, warehouse_id, type (warning/overdue/reminder), message, read, dismissed

**RLS:** Warehouse-scoped SELECT; regional/super_admin manage schedules; chef_agence/operations/super_admin execute sessions and checks; notifications are user-scoped.

**Trigger:** After `inventory_sessions.completed_at` transitions to non-NULL, auto-create next scheduled inventory if parent is recurring.

**RPC:** `check_overdue_inventories()` — marks pending as overdue, creates notifications for relevant users.

**Indexes** on warehouse_id, session_id, user_id columns.

Uses validation triggers (not CHECK constraints) for status/type fields. FK references go to `profiles.id`, not `auth.users`.

---

### Phase 2 — New Components

**`src/components/InventorySchedule.tsx`** — Planning (regional/super_admin)
- Create form: warehouse dropdown, datetime, recurring toggle + interval
- Table of scheduled inventories with status badges, edit/cancel actions

**`src/components/InventoryExecution.tsx`** — Scanning (chef_agence/operations/super_admin)
- Select box → see expected parcels → scan field (reusing AddParcel QR pattern)
- Match scan against expected: ✅ success sound / ❌ error sound + "extra" list
- Live counter (scanned / expected)
- "Finish box" saves inventory_check with discrepancies JSON
- "Close inventory" sets completed_at, triggers recurrence

**`src/components/InventoryReports.tsx`** — Reporting
- Table of completed sessions with details modal (per-box breakdown)
- Excel export (dynamic xlsx import per existing pattern)

---

### Phase 3 — Navigation & Integration

**`AppLayout.tsx`:**
- Add `'inventory'` page type with "Inventaires" nav item (ClipboardCheck icon)
- Visible for regional, chef_agence, super_admin
- Routes to InventorySchedule (regional/super_admin) or InventoryExecution (others)

**`Dashboard.tsx`:**
- New card: next scheduled inventory date, overdue badge, "Lancer l'inventaire" button
- Notification alerts from inventory_notifications

**`AdvancedStatistics.tsx`:**
- New "Inventaires" tab embedding InventoryReports

---

### Phase 4 — Sound & UX
- Reuse `useSound` hook for scan feedback
- Preload all box parcels at session start (avoid per-scan queries)
- JSONB discrepancies for easy frontend rendering

### Files
- **New:** `InventorySchedule.tsx`, `InventoryExecution.tsx`, `InventoryReports.tsx`
- **Modified:** `AppLayout.tsx`, `Dashboard.tsx`, `AdvancedStatistics.tsx`
- **Migration:** 1 file (4 tables + RLS + trigger + function + indexes)

