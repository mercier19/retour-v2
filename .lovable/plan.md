

## Inventory Fixes and Enhancements

### Overview
Six changes: tracking case normalization, overdue threshold to 4h, PDF report generation, dashboard warehouse name display, created_by/created_at columns in schedule list, and tracking format validation.

---

### 1. Tracking Case Normalization

**Migration:** Create a `BEFORE INSERT OR UPDATE` trigger on `parcels` that uppercases `NEW.tracking`.

**Code changes:**
- `InventoryExecution.tsx` line ~165: compare with `p.tracking === tracking.toUpperCase()` (or just `.toUpperCase()` the scan input)
- `AddParcel.tsx`: uppercase tracking before insert
- All other scan/search comparisons: apply `.toUpperCase()` client-side as well

---

### 2. Overdue Threshold: 24h → 4h

**Migration:** Replace in `check_overdue_inventories()`:
- `NOW() - INTERVAL '24 hours'` → `NOW() - INTERVAL '4 hours'` (both occurrences)

---

### 3. Inventory PDF Report

**New file:** `src/components/InventoryReportModal.tsx`

- Accepts a completed `InventorySession` as prop
- Fetches: inventory_checks (with box names), profiles for `completed_by` and `created_by`, and the linked `scheduled_inventories` record for `created_by`/`created_at`
- Displays summary: date, duration, created by, executed by, notes, box-by-box discrepancies
- "Export PDF" button using `jspdf` (dynamic import): generates a formatted PDF with all the above data

**Modified:** `src/components/InventoryReports.tsx` — add a "PDF" button per session row that opens the modal

---

### 4. Dashboard: Show Warehouse Name on Next Inventory

**Modified:** `src/components/Dashboard.tsx`
- `loadNextInventory`: add `warehouse_id` to the select
- In the next inventory card, display `warehouseNames[nextInventory.warehouse_id]` alongside the date

---

### 5. Created_by & Created_at in Schedule List

**Modified:** `src/components/InventorySchedule.tsx`
- After loading inventories, fetch profile names for all distinct `created_by` IDs
- Add two columns to the table: "Créé par" (full_name) and "Date de création" (formatted `created_at`)

---

### 6. Tracking Format Validation

**Code changes in `AddParcel.tsx`:**
- Before insert, validate tracking against regex `^(YAL|ECH|ACC|RCC)-[A-Z0-9]{6}$` (case-insensitive, then uppercased)
- Show toast error if invalid format
- Apply same validation in `InventoryExecution.tsx` scan handler (optional warning)

---

### Files Summary

| File | Action |
|------|--------|
| Migration SQL | New trigger (uppercase tracking) + updated `check_overdue_inventories` |
| `src/components/InventoryReportModal.tsx` | New — PDF report modal |
| `src/components/InventoryReports.tsx` | Add PDF button per session |
| `src/components/InventorySchedule.tsx` | Add created_by/created_at columns |
| `src/components/Dashboard.tsx` | Show warehouse name on next inventory card |
| `src/components/InventoryExecution.tsx` | Uppercase tracking comparison |
| `src/components/AddParcel.tsx` | Uppercase + regex validation |

