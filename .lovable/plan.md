

## Multi-Part Parcel Support

### Problem
Currently, scanning the same tracking number twice is rejected as a duplicate due to the `UNIQUE(warehouse_id, tracking)` constraint. Some shipments consist of multiple physical boxes under one tracking number (e.g., 8 cartons), and the system needs to handle each part individually.

### Database Changes

**Migration:**
1. Add three columns to `parcels`: `is_multi_part BOOLEAN DEFAULT false`, `part_number INTEGER DEFAULT 1`, `total_parts INTEGER DEFAULT 1`
2. Add same columns to `archived_parcels` for consistency
3. Drop the existing `UNIQUE(warehouse_id, tracking)` constraint
4. Add new `UNIQUE(warehouse_id, tracking, part_number)` constraint
5. Update the `log_parcel_status_change` trigger — no changes needed (it already logs per-parcel row)

### Code Changes

**`src/types/database.ts`** — Add `is_multi_part`, `part_number`, `total_parts` to `Parcel` and `ArchivedParcel` interfaces.

**`src/components/AddParcel.tsx`** — Both manual and QR modes:
- Add state: `isMultiPart`, `totalParts`, and a dialog for prompting total parts on first scan
- On insert attempt, if duplicate error (23505):
  - Query existing parcels with that tracking in the warehouse
  - If existing parcel is multi-part: auto-insert next part (part_number + 1). If all parts received, show warning.
  - If existing parcel is NOT multi-part: show the current duplicate error
- On first scan of a new multi-part tracking (checkbox enabled in manual mode): prompt for total parts, insert with `is_multi_part=true, part_number=1, total_parts=N`
- In QR mode: on duplicate, check if existing is multi-part and auto-increment; if not multi-part, prompt user "Ce tracking a plusieurs parties?" with a total parts input, then convert existing to multi-part and add part 2

**`src/components/SearchParcels.tsx`**:
- Add `part_number, total_parts, is_multi_part` to select queries
- Display "Partie X/Y" badge next to tracking when `is_multi_part`
- In results list, group by tracking (sort by tracking then part_number) so all parts appear together
- In history dialog header, show "Partie X/Y"

**`src/components/DonnerRetours.tsx`**:
- Add `part_number, total_parts, is_multi_part` to select query
- Display "X/Y" next to tracking in the list
- Each part is independently selectable and can be marked missing individually

**`src/components/TransferParcels.tsx`**:
- Add `part_number, total_parts, is_multi_part` to select query
- Display "X/Y" next to tracking in the list
- Each part transfers independently

**`src/components/StockControl.tsx`**:
- Include `part_number, total_parts` in archive data mapping

**`src/components/Statistics.tsx`**:
- No structural changes needed; each part is already a separate row

### UI/UX Details

- **AddParcel manual mode**: Checkbox "Ce colis a plusieurs parties" → reveals "Nombre total de parties" number input
- **AddParcel QR mode**: On duplicate detection, auto-check if multi-part and increment; if new multi-part scenario, show a dialog asking for total parts
- **All lists**: Show a small badge "2/8" after tracking number when `is_multi_part`
- **Missing flagging**: Works per-part already since each part is a separate DB row

