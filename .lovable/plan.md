

## Problem

The boutique dropdown in "Donner les retours" uses a Radix `Select` with an `Input` embedded inside `SelectContent`. This doesn't work because Radix Select captures keyboard events, preventing the search input from functioning. Boutiques also don't show until you type.

## Solution

Replace the `Select` component with a **Popover + Command (combobox)** pattern using the existing `cmdk`-based Command components. This provides:
- All boutiques visible immediately on open
- Native keyboard search/filtering that actually works
- Proper selection behavior

## Changes

**`src/components/DonnerRetours.tsx`**:
1. Replace `Select` imports with `Popover`, `PopoverTrigger`, `PopoverContent` and `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, `CommandItem`
2. Replace the boutique Select block (lines 200-224) with a Popover+Command combobox:
   - `PopoverTrigger` styled like a select trigger showing the selected boutique or placeholder
   - `CommandInput` for filtering boutiques
   - `CommandList` with `CommandItem` for each boutique
   - On item select: set `search` to the boutique name, close popover
3. Add `open`/`setOpen` state for the popover
4. Remove `boutiqueSearch` state (Command handles filtering internally)

