

## Add Dedicated "Particulier [Yalidine]" Section in DonnerRetours

### What
Add a standalone card above the main parcel table that lists all in-stock parcels for boutique "Particulier [Yalidine]". Each parcel gets an individual "Donner" button that archives it and opens the Yalidine particulier returns page — without marking other parcels as missing.

### Changes — `src/components/DonnerRetours.tsx`

**1. New state**
- `particulierParcels`: array of parcels with `boutique = 'Particulier [Yalidine]'`, `status = 'in_stock'`, `is_missing != true`
- `givingParticulierId`: tracks which parcel's button is processing (loading state)

**2. New data loader — `loadParticulierParcels`**
- Query `parcels` table filtered by:
  - `boutique = 'Particulier [Yalidine]'` (strict `eq`)
  - `status = 'in_stock'`
  - `is_missing = false`
  - `warehouse_id` matching current filter (single or multi-warehouse via `.in()`)
- Join `boxes(name)` for box display
- Called on mount and after each give action, alongside existing `loadBoutiques`

**3. New handler — `handleGiveParticulier(parcelId)`**
- Set `givingParticulierId` to disable the button
- Fetch the parcel from `particulierParcels` state
- Insert into `archived_parcels` (tracking, boutique, box_name, wilaya, commune, status: 'given', warehouse_id, created_at, phone, delivery_type, is_multi_part, part_number, total_parts)
- Delete from `parcels`
- On success:
  - Remove from `particulierParcels` state
  - Also remove from main `parcels` state if present
  - Open `https://yalidine.app/app/particulier/remettre_retour.php?hi=${warehouseCode}` in new tab
  - Show success toast
  - Log action via `logUserAction`
- On failure: show error toast, keep list unchanged
- Clear `givingParticulierId`

**4. UI — Dedicated card**
- Rendered between the filter card and the select-all toolbar, only when `particulierParcels.length > 0`
- Card header: "Particulier [Yalidine]" with a count badge
- Simple list of cards (matching existing style) with columns:
  - Tracking + copy button
  - Box name
  - Date (formatted same as main table)
  - "Donner" button (disabled while processing)
- No checkboxes, no missing toggle, no transfer button

**5. No changes to existing logic**
- Main table and bulk give flow remain untouched
- Particulier parcels may also appear in the main table when searched; the dedicated section is an independent shortcut

### Technical Notes
- The archive insert mirrors the pattern already used in `markGiven` but targets a single parcel
- Warehouse code is resolved from `currentWarehouse?.code` (from `useWarehouseFilter`)
- No database migration needed

