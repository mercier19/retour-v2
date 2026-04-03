
## Inventory Management System

### Overview
Add a full inventory system: regional users schedule inventories (one-time or recurring), warehouse staff execute them by scanning parcels box-by-box, and reports show discrepancies. This is a large feature spanning database schema, RLS policies, triggers, UI components, and navigation.

### Phase 1 — Database Migration

Create 4 new tables with UUIDs (not SERIAL, consistent with existing schema):

**`scheduled_inventories`** — planned inventory events
- `id` UUID PK, `warehouse_id` UUID FK→warehouses, `scheduled_date` TIMESTAMPTZ, `created_by` UUID, `status` TEXT default 'pending', `is_recurring` BOOLEAN default false, `interval_days` INTEGER, `created_at` TIMESTAMPTZ

**`inventory_sessions`** — active/completed inventory executions
- `id` UUID PK, `scheduled_inventory_id` UUID FK→scheduled_inventories (nullable for ad-hoc), `warehouse_id` UUID FK→warehouses, `started_at` TIMESTAMPTZ, `completed_at` TIMESTAMPTZ, `completed_by` UUID, `notes` TEXT

**`inventory_checks`** — per-box scan results
- `id` UUID PK, `inventory_session_id` UUID FK→inventory_sessions, `box_id` UUID FK→boxes, `expected_count` INTEGER, `actual_count` INTEGER, `discrepancies` JSONB, `checked_at` TIMESTAMPTZ, `checked_by` UUID

**`inventory_notifications`** — alerts for overdue/warnings
- `id` UUID PK, `warehouse_id` UUID FK→warehouses, `user_id` UUID, `type` TEXT, `message` TEXT, `created_at` TIMESTAMPTZ, `read` BOOLEAN default false, `dismissed` BOOLEAN default false

Use validation triggers (not CHECK constraints) for `status` and `type` fields.

**RLS Policies:**
- `scheduled_inventories`: SELECT for users with warehouse access; INSERT/UPDATE/DELETE for regional/super_admin
- `inventory_sessions`: SELECT for warehouse users; INSERT/UPDATE for chef_agence/operations/super_admin
- `inventory_checks`: SELECT via join to sessions; INSERT for warehouse staff
- `inventory_notifications`: SELECT/UPDATE own only; super_admin sees all

**Trigger:** `create_next_recurring_inventory` — fires AFTER UPDATE on `inventory_sessions` when `completed_at` transitions from NULL to non-NULL; inserts next scheduled inventory if parent is recurring.

**RPC function:** `check_overdue_inventories()` — SECURITY DEFINER function that marks pending inventories as overdue and creates notifications.

**Indexes** on warehouse_id, session_id, and user_id columns.

### Phase 2 — New Components

**`src/components/InventorySchedule.tsx`** — Planning page (regional/super_admin only)
- Form: warehouse dropdown, datetime picker, recurring toggle with interval_days
- Table of scheduled inventories with status badges, edit/cancel actions
- Filter by warehouse and status

**`src/components/InventoryExecution.tsx`** — Scanning interface (chef_agence/operations/super_admin)
- Step 1: Select a box from warehouse boxes
- Step 2: Shows expected parcels list (from `parcels` where `box_id` matches, `status = 'in_stock'`)
- Step 3: QR/barcode scan input field (reusing AddParcel pattern)
  - Match against expected → green ✅ + success sound
  - Not in expected → red ❌ + error sound, added to "extra" list
  - Live counter: scanned / expected
- "Finish box" button: saves `inventory_checks` row with expected_count, actual_count, discrepancies JSON `{missing: [...], extra: [...]}`
- Progress indicator showing checked boxes vs total
- "Close inventory" button: sets `completed_at`, updates scheduled status to 'completed'

**`src/components/InventoryReports.tsx`** — Reporting (embedded in AdvancedStatistics as new tab)
- Table of completed sessions: date, warehouse, operator, notes
- "Details" modal: per-box breakdown showing expected/actual/missing/extra
- Excel export using dynamic xlsx import (existing pattern)

### Phase 3 — Navigation & Integration

**`src/components/AppLayout.tsx`** updates:
- Add `'inventory'` to Page type
- New nav item "Inventaires" with `ClipboardCheck` icon
  - Visible for: regional, chef_agence, super_admin
- `renderPage`: route to a wrapper that shows InventorySchedule (for regional/super_admin) or InventoryExecution (for chef_agence/operations)

**`src/components/Dashboard.tsx`** updates:
- New card showing next scheduled inventory date with countdown
- Badge for overdue status
- "Lancer l'inventaire" button when scheduled_date <= now + 1h or status = 'overdue'
- Notification alerts from `inventory_notifications`

**`src/components/AdvancedStatistics.tsx`** updates:
- Add "Inventaires" tab containing InventoryReports component

### Phase 4 — Sound & UX

- Reuse `useSound` hook for scan feedback during inventory execution
- Preload all box parcels at session start to avoid per-scan queries
- Store discrepancies as JSONB for easy frontend rendering

### Technical Notes
- All FK references use `profiles.id` (not `auth.users`), consistent with existing schema
- Box IDs are UUID type (matching `boxes.id`), not INTEGER
- Use validation triggers instead of CHECK constraints for status fields
- No edge function needed initially; `check_overdue_inventories` can be called via RPC or scheduled later
- Dynamic xlsx import for Excel export (per existing bundle constraint)

### Files Created/Modified
- **New:** `src/components/InventorySchedule.tsx`, `src/components/InventoryExecution.tsx`, `src/components/InventoryReports.tsx`
- **Modified:** `src/components/AppLayout.tsx` (nav + routing), `src/components/Dashboard.tsx` (inventory card), `src/components/AdvancedStatistics.tsx` (reports tab)
- **Migration:** 1 migration file for all 4 tables, RLS, trigger, function, indexes
