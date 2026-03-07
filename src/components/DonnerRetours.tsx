import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { toast } from 'sonner';
import { Search, AlertTriangle, HandCoins, CheckSquare, XSquare, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ParcelWithDetails {
  id: string;
  tracking: string;
  boutique: string | null;
  box_id: string | null;
  box_name: string | null;
  is_missing: boolean | null;
  created_at: string;
  added_by: string | null;
  added_by_name: string | null;
  warehouse_id: string;
  status: string | null;
  is_multi_part: boolean;
  part_number: number;
  total_parts: number;
}

const DonnerRetours: React.FC = () => {
  const { warehouseId, warehouseIds, showAll } = useWarehouseFilter();
  const [parcels, setParcels] = useState<ParcelWithDetails[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'tracking' | 'boutique'>('boutique');
  const [boutiques, setBoutiques] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  const loadParcels = async (query: string) => {
    if (!warehouseId && !showAll || !query.trim()) {
      setParcels([]);
      return;
    }

    setLoading(true);
    let dbQuery = supabase.
    from('parcels').
    select('id, tracking, boutique, box_id, is_missing, created_at, warehouse_id, status, added_by, is_multi_part, part_number, total_parts, boxes(name), profiles:added_by(full_name)').
    eq('status', 'in_stock');

    if (showAll) {
      dbQuery = dbQuery.in('warehouse_id', warehouseIds);
    } else {
      dbQuery = dbQuery.eq('warehouse_id', warehouseId!);
    }

    if (searchMode === 'tracking') {
      dbQuery = dbQuery.ilike('tracking', `%${query.trim()}%`);
    } else {
      dbQuery = dbQuery.ilike('boutique', `%${query.trim()}%`);
    }

    const { data } = await dbQuery.order('tracking').order('part_number').limit(200);

    if (data) {
      setParcels(data.map((p: any) => ({
        id: p.id,
        tracking: p.tracking,
        boutique: p.boutique,
        box_id: p.box_id,
        box_name: p.boxes?.name || null,
        is_missing: p.is_missing,
        created_at: p.created_at,
        added_by: p.added_by,
        added_by_name: p.profiles?.full_name || null,
        warehouse_id: p.warehouse_id,
        status: p.status,
        is_multi_part: p.is_multi_part ?? false,
        part_number: p.part_number ?? 1,
        total_parts: p.total_parts ?? 1
      })));
    }
    setLoading(false);
  };

  const loadBoutiques = async () => {
    const ids = showAll ? warehouseIds : warehouseId ? [warehouseId] : [];
    if (ids.length === 0) return;
    const { data } = await supabase.
    from('parcels').
    select('boutique').
    eq('status', 'in_stock').
    in('warehouse_id', ids).
    not('boutique', 'is', null);
    const unique = Array.from(new Set((data || []).map((p: any) => p.boutique).filter(Boolean))).sort() as string[];
    setBoutiques(unique);
  };

  useEffect(() => {
    loadBoutiques();
  }, [warehouseId, showAll]);

  useEffect(() => {
    if (searchMode === 'boutique' && search) {
      loadParcels(search);
    } else if (searchMode === 'tracking' && search.trim().length >= 2) {
      const timeout = setTimeout(() => loadParcels(search), 300);
      return () => clearTimeout(timeout);
    } else {
      setParcels([]);
    }
  }, [search, searchMode, warehouseId, showAll]);

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === parcels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(parcels.map((p) => p.id)));
    }
  };

  const unselectMissing = () => {
    const missingIds = new Set(parcels.filter((p) => p.is_missing).map((p) => p.id));
    const next = new Set(selected);
    missingIds.forEach((id) => next.delete(id));
    setSelected(next);
  };

  const markGiven = async () => {
    if (selected.size === 0) return;

    const unselectedIds = parcels.filter((p) => !selected.has(p.id)).map((p) => p.id);

    const { error: givenError } = await supabase.
    from('parcels').
    update({ status: 'given', given_at: new Date().toISOString() }).
    in('id', Array.from(selected));

    if (givenError) {
      toast.error(givenError.message);
      return;
    }

    if (unselectedIds.length > 0) {
      await supabase.
      from('parcels').
      update({ is_missing: true }).
      in('id', unselectedIds);
    }

    toast.success(`${selected.size} colis donné(s)${unselectedIds.length > 0 ? `, ${unselectedIds.length} marqué(s) manquant(s)` : ''}`);
    setSelected(new Set());
    setSearch('');
    setParcels([]);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold"> Remettre des retours</h1>
        {selected.size > 0 &&
        <Button onClick={markGiven}>
            <HandCoins className="w-4 h-4 mr-1" /> Donner ({selected.size})
          </Button>
        }
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex gap-2 items-center mb-3">
            <Button
              variant={searchMode === 'boutique' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {setSearchMode('boutique');setSearch('');setParcels([]);setSelected(new Set());}}>
              
              Par boutique
            </Button>
            <Button
              variant={searchMode === 'tracking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {setSearchMode('tracking');setSearch('');setParcels([]);setSelected(new Set());}}>
              
              Par tracking
            </Button>
          </div>
          {searchMode === 'boutique' ?
          <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
                  {search || "Sélectionner une boutique..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Rechercher une boutique..." />
                  <CommandList>
                    <CommandEmpty>Aucune boutique trouvée.</CommandEmpty>
                    <CommandGroup>
                      {boutiques.map((b) =>
                    <CommandItem
                      key={b}
                      value={b}
                      onSelect={() => {setSearch(b);setOpen(false);}}>
                      
                          <Check className={cn("mr-2 h-4 w-4", search === b ? "opacity-100" : "opacity-0")} />
                          {b}
                        </CommandItem>
                    )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover> :

          <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par tracking..."
              className="pl-9"
              autoFocus />
            
            </div>
          }
        </CardContent>
      </Card>

      {parcels.length > 0 &&
      <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={selectAll}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {selected.size === parcels.length ? 'Tout désélectionner' : 'Tout sélectionner'}
          </Button>
          <Button variant="outline" size="sm" onClick={unselectMissing}>
            <XSquare className="w-4 h-4 mr-1" />
            Désélectionner manquants
          </Button>
          <span className="text-sm text-muted-foreground">
            {parcels.length} résultat(s) · {selected.size} sélectionné(s) · {parcels.filter((p) => p.is_missing).length} manquant(s)
          </span>
        </div>
      }

      {loading && <p className="text-muted-foreground text-center py-4">Chargement...</p>}

      <div className="space-y-1">
        {parcels.map((parcel) =>
        <Card key={parcel.id} className={`glass-card ${parcel.is_missing ? 'border-destructive/50 bg-destructive/5' : ''}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox checked={selected.has(parcel.id)} onCheckedChange={() => toggleSelect(parcel.id)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm font-medium truncate">{parcel.tracking}</p>
                  {parcel.is_multi_part &&
                <Badge variant="outline" className="text-xs font-mono">{parcel.part_number}/{parcel.total_parts}</Badge>
                }
                  {parcel.is_missing &&
                <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">manquant</span>
                }
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {parcel.boutique && <span className="font-medium text-foreground/80">{parcel.boutique}</span>}
                  {parcel.box_name && <span>📦 {parcel.box_name}</span>}
                  <span>🕐 {formatDate(parcel.created_at)}</span>
                  {parcel.added_by_name && <span>👤 {parcel.added_by_name}</span>}
                </div>
              </div>
              <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                const { error } = await supabase.from('parcels').update({ is_missing: !parcel.is_missing }).eq('id', parcel.id);
                if (error) toast.error(error.message);else
                {
                  setParcels((prev) => prev.map((p) => p.id === parcel.id ? { ...p, is_missing: !p.is_missing } : p));
                  toast.success(parcel.is_missing ? 'Marqué trouvé' : 'Marqué manquant');
                }
              }}
              title={parcel.is_missing ? 'Marquer trouvé' : 'Marquer manquant'}>
              
                <AlertTriangle className={`w-4 h-4 ${parcel.is_missing ? 'text-destructive' : 'text-muted-foreground'}`} />
              </Button>
            </CardContent>
          </Card>
        )}

        {search && !loading && parcels.length === 0 &&
        <p className="text-muted-foreground text-center py-8">Aucun colis trouvé</p>
        }

        {!search &&
        <p className="text-muted-foreground text-center py-8">
            {searchMode === 'boutique' ? 'Sélectionnez une boutique pour afficher les colis' : 'Tapez au moins 2 caractères pour rechercher'}
          </p>
        }
      </div>
    </div>);

};

export default DonnerRetours;