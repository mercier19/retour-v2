

## Admin Permissions System

### Overview
Create a fine-grained permissions system: a `user_permissions` table for per-user overrides, a `usePermission` hook for checking access throughout the app, and an admin page for managing it all.

---

### Phase 1 — Database Migration

**New table: `user_permissions`**
- Columns: `id` (UUID PK), `user_id` (UUID FK → profiles), `permission_key` (TEXT), `granted` (BOOLEAN), `created_at`, `updated_at`
- Unique constraint on `(user_id, permission_key)`
- RLS: super_admin can do ALL; users can SELECT their own rows

**No CHECK constraint on permission_key** — validated at the application level.

---

### Phase 2 — Permission Defaults Map + Hook

**`src/hooks/usePermission.ts`**
- Define a `DEFAULT_ROLE_PERMISSIONS` map: for each role, which permission keys are granted by default
- Fetch current user's `user_permissions` rows once (cached in state/context)
- `usePermission(key: string) → boolean`:
  - super_admin → always true
  - If override exists in `user_permissions` → use `granted` value
  - Otherwise → use role default from map
- Also export `usePermissions()` returning the full resolved map (for the admin page)

**`src/contexts/PermissionContext.tsx`**
- Wraps the app inside AuthProvider, loads user_permissions on login
- Provides permissions data to the hook

---

### Phase 3 — Admin Permissions Page

**`src/components/admin/Permissions.tsx`**

**Section 1 — Individual user management:**
- Searchable user dropdown (all profiles)
- Role editor (dropdown of 4 roles)
- Permission table grouped by category (Pages / Actions), each with a Switch toggle
- Visual indicator when a permission differs from role default ("Personnalisé" badge)
- "Apply" button: updates `profiles.role` if changed + upserts `user_permissions` for overrides only
- "Reset" button: deletes all `user_permissions` for that user

**Section 2 — Bulk operations:**
- User list with checkboxes for multi-select
- Actions panel:
  - Change role for all selected
  - Grant/revoke a specific permission for all selected
  - Reset all overrides for selected
- Confirmation with count of affected users before applying

---

### Phase 4 — App Integration

**`src/components/AppLayout.tsx`:**
- Add `'permissions'` to Page type
- Add nav item "Permissions" (Shield icon), visible only for super_admin
- Replace current `show` logic in navItems to use `usePermission('page_xxx')` for each page
- Render `<Permissions />` for the permissions page

**Component-level guards:**
- In components that perform protected actions (transfer, give parcels, mark missing, etc.), use `usePermission('action_xxx')` to conditionally render or disable buttons

---

### Files

- **New:** `src/hooks/usePermission.ts`, `src/contexts/PermissionContext.tsx`, `src/components/admin/Permissions.tsx`
- **Modified:** `src/components/AppLayout.tsx` (nav + page routing + permission checks), `src/App.tsx` (wrap with PermissionProvider), `src/types/database.ts` (add UserPermission type)
- **Migration:** 1 file (user_permissions table + RLS)

### Permission Keys

**Pages:** `page_dashboard`, `page_add_parcel`, `page_boxes`, `page_donner_retours`, `page_stock_control`, `page_statistics`, `page_advanced_stats`, `page_search`, `page_transfer`, `page_inventory`, `page_admin_users`, `page_admin_warehouses`, `page_admin_permissions`

**Actions:** `action_transfer_parcel`, `action_give_parcels`, `action_mark_missing`, `action_clear_box`, `action_export_excel`, `action_export_pptx`, `action_edit_box`, `action_plan_inventory`, `action_execute_inventory`

### Default Role Map (example)

```text
                        operations  chef_agence  regional  super_admin
page_dashboard              ✓           ✓          ✓          ✓
page_add_parcel             ✓           ✓          ✓          ✓
page_boxes                  ✗           ✓          ✓          ✓
page_donner_retours         ✓           ✓          ✓          ✓
page_stock_control          ✗           ✗          ✓          ✓
page_statistics             ✓           ✓          ✓          ✓
page_advanced_stats         ✗           ✗          ✓          ✓
page_search                 ✓           ✓          ✓          ✓
page_transfer               ✓           ✓          ✓          ✓
page_inventory              ✗           ✓          ✓          ✓
page_admin_users            ✗           ✗          ✗          ✓
page_admin_warehouses       ✗           ✗          ✗          ✓
page_admin_permissions      ✗           ✗          ✗          ✓
action_give_parcels         ✓           ✓          ✓          ✓
action_mark_missing         ✓           ✓          ✓          ✓
action_transfer_parcel      ✓           ✓          ✓          ✓
action_clear_box            ✗           ✓          ✓          ✓
action_edit_box             ✗           ✓          ✓          ✓
action_export_excel         ✓           ✓          ✓          ✓
action_export_pptx          ✗           ✗          ✓          ✓
action_plan_inventory       ✗           ✗          ✓          ✓
action_execute_inventory    ✗           ✓          ✓          ✓
```

