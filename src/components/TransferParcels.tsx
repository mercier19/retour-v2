import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Warehouse {
  id: string;
  name: string;
  code: string;
  type: string;
}

interface ParcelItem {
  id: string;
  tracking: string;
  boutique: string | null;
  box_name: string | null;
  status: string | null;
  warehouse_id: string;
}

const TransferParcels: React.FC = () => {
  const { warehouseId, warehouseIds, showAll, currentWarehouse } = useWarehouseFilter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [destinationId, setDestinationId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);

  // Load all warehouses for destination picker
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('warehouses')
        .select('id, name, code, type')
        .order('name');
      setWarehouses(data || []);
    };
    load();
  }, []);

  // Search parcels
  useEffect(() => {
    if ((!warehouseId && !showAll) || !search.trim()) {
      setParcels([]);
      return;
    }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId, showAll]);

  const doSearch = async () => {
    if ((!warehouseId && !showAll) || !search.trim()) return;
    const s = search.trim();
    let query = supabase
      .from('parcels')
      .select('id, tracking, boutique, status, warehouse_id, boxes(name)')
      .or(`tracking.ilike.%${s}%,boutique.ilike.%${s}%`)
      .limit(50);

    if (showAll) {
      query = query.in('warehouse_id', warehouseIds);
    } else {
      query = query.eq('warehouse_id', warehouseId!);
    }

    const { data } = await query;
    setParcels(
      (data || []).map((p: any) => ({
        id: p.id,
        tracking: p.tracking,
        boutique: p.boutique,
        box_name: p.boxes?.name || null,
        status: p.status,
        warehouse_id: p.warehouse_id,
      }))
    );
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === parcels.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(parcels.map((p) => p.id)));
    }
  };

  const destinationWarehouse = warehouses.find((w) => w.id === destinationId);

  const handleTransfer = async () => {
    if (!destinationId || selected.size === 0) return;
    if (!destinationWarehouse) return;

    setTransferring(true);
    const newStatus = `Transfert vers ${destinationWarehouse.name}`;
    const ids = Array.from(selected);

    // Update status for each selected parcel
    const { error } = await supabase
      .from('parcels')
      .update({
        status: newStatus,
        warehouse_id: destinationId,
        box_id: null,
      })
      .in('id', ids);

    if (error) {
      toast.error('Erreur lors du transfert: ' + error.message);
    } else {
      toast.success(`${ids.length} colis transféré(s) vers ${destinationWarehouse.name}`);
      setSelected(new Set());
      setParcels((prev) => prev.filter((p) => !ids.includes(p.id)));
    }
    setTransferring(false);
  };

  // Filter out current warehouse from destinations
  const destinationOptions = warehouses.filter((w) => {
    if (showAll) return true;
    return w.id !== warehouseId;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transférer des colis</h1>

      {/* Destination selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Destination</label>
        <Select value={destinationId} onValueChange={setDestinationId}>
          <SelectTrigger>
            <SelectValue placeholder="Sélectionner une destination..." />
          </SelectTrigger>
          <SelectContent>
            {destinationOptions.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name} ({w.code}) — {w.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par tracking ou boutique..."
          className="pl-10 h-12 text-lg"
        />
      </div>

      {/* Select all + transfer button */}
      {parcels.length > 0 && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selected.size === parcels.length && parcels.length > 0}
              onCheckedChange={toggleAll}
            />
            <span className="text-sm text-muted-foreground">
              {selected.size} / {parcels.length} sélectionné(s)
            </span>
          </div>
          <Button
            onClick={handleTransfer}
            disabled={!destinationId || selected.size === 0 || transferring}
          >
            {transferring ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <ArrowRightLeft className="w-4 h-4 mr-2" />
            )}
            Transférer ({selected.size})
          </Button>
        </div>
      )}

      {/* Parcels list */}
      <div className="space-y-2">
        {parcels.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-all ${
              selected.has(p.id) ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/30'
            }`}
            onClick={() => toggleSelect(p.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleSelect(p.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm font-medium truncate">{p.tracking}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {p.boutique && <span className="font-medium text-foreground/80">{p.boutique}</span>}
                    {p.box_name && <span>📦 {p.box_name}</span>}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {p.status || 'in_stock'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
        {search && parcels.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucun résultat</p>
        )}
      </div>
    </div>
  );
};

export default TransferParcels;
