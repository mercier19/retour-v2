import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, ArrowRightLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import CopyTrackingButton from '@/components/CopyTrackingButton';

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
  transfer_status: string | null;
  destination_warehouse_id: string | null;
  misrouted_at_warehouse_id: string | null;
  warehouse_id: string;
  is_multi_part: boolean;
  part_number: number;
  total_parts: number;
}

const TransferParcels: React.FC = () => {
  const { warehouseId, warehouseIds, showAll, hasRole } = useWarehouseFilter();
  const { user } = useAuth();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [destinationId, setDestinationId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [parcels, setParcels] = useState<ParcelItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [transferring, setTransferring] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const canTransfer = hasRole('chef_agence', 'regional', 'super_admin');

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('warehouses').select('id, name, code, type').order('name');
      setWarehouses(data || []);
    };
    load();
  }, []);

  useEffect(() => {
    if ((!warehouseId && !showAll) || !search.trim()) { setParcels([]); return; }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId, showAll, filterStatus]);

  const doSearch = async () => {
    if ((!warehouseId && !showAll) || !search.trim()) return;
    const s = search.trim();
    let query = supabase
      .from('parcels')
      .select('id, tracking, boutique, status, warehouse_id, is_multi_part, part_number, total_parts, transfer_status, destination_warehouse_id, boxes(name)')
      .or(`tracking.ilike.%${s}%,boutique.ilike.%${s}%`)
      .order('tracking')
      .order('part_number')
      .limit(50);

    if (showAll) {
      query = query.in('warehouse_id', warehouseIds);
    } else {
      query = query.eq('warehouse_id', warehouseId!);
    }

    if (filterStatus === 'in_transit') {
      query = query.eq('transfer_status', 'in_transit');
    } else if (filterStatus === 'misrouted') {
      query = query.eq('transfer_status', 'misrouted');
    } else if (filterStatus === 'in_stock') {
      query = query.eq('transfer_status', 'in_stock');
    }

    const { data } = await query;
    setParcels(
      (data || []).map((p: any) => ({
        id: p.id,
        tracking: p.tracking,
        boutique: p.boutique,
        box_name: p.boxes?.name || null,
        status: p.status,
        transfer_status: p.transfer_status,
        destination_warehouse_id: p.destination_warehouse_id,
        warehouse_id: p.warehouse_id,
        is_multi_part: p.is_multi_part ?? false,
        part_number: p.part_number ?? 1,
        total_parts: p.total_parts ?? 1,
      }))
    );
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const transferable = parcels.filter(p => p.transfer_status === 'in_stock');
    if (selected.size === transferable.length) setSelected(new Set());
    else setSelected(new Set(transferable.map((p) => p.id)));
  };

  const destinationWarehouse = warehouses.find((w) => w.id === destinationId);
  const getWarehouseName = (id: string | null) => warehouses.find(w => w.id === id)?.name || '?';

  const handleTransfer = async () => {
    if (!destinationId || selected.size === 0 || !destinationWarehouse || !user) return;
    setTransferring(true);

    const ids = Array.from(selected);
    const newStatus = `Transfert vers ${destinationWarehouse.name}`;

    // Update parcels
    const { error } = await supabase
      .from('parcels')
      .update({
        status: newStatus,
        transfer_status: 'in_transit',
        destination_warehouse_id: destinationId,
        transfer_initiated_at: new Date().toISOString(),
        box_id: null,
      })
      .in('id', ids);

    if (error) {
      toast.error('Erreur lors du transfert: ' + error.message);
      setTransferring(false);
      return;
    }

    // Insert transfer_history records
    const currentWid = warehouseId;
    const historyRecords = ids.map(pid => {
      const parcel = parcels.find(p => p.id === pid);
      return {
        parcel_id: pid,
        from_warehouse_id: parcel?.warehouse_id || currentWid!,
        to_warehouse_id: destinationId,
        initiated_by: user.id,
        status: 'pending',
      };
    });

    const { error: histError } = await supabase.from('transfer_history').insert(historyRecords);
    if (histError) {
      console.error('transfer_history insert error:', histError);
    }

    toast.success(`${ids.length} colis transféré(s) vers ${destinationWarehouse.name}`);
    setSelected(new Set());
    // Refresh
    doSearch();
    setTransferring(false);
  };

  const destinationOptions = warehouses.filter((w) => showAll || w.id !== warehouseId);

  const getTransferBadge = (p: ParcelItem) => {
    if (p.transfer_status === 'in_transit') {
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-300 shrink-0">En transfert → {getWarehouseName(p.destination_warehouse_id)}</Badge>;
    }
    if (p.transfer_status === 'misrouted') {
      return <Badge variant="destructive" className="shrink-0">Mal dirigé</Badge>;
    }
    return <Badge variant="outline" className="shrink-0">{p.status || 'En stock'}</Badge>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transférer des colis</h1>

      {canTransfer && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Destination</label>
          <Select value={destinationId} onValueChange={setDestinationId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner une destination..." /></SelectTrigger>
            <SelectContent>
              {destinationOptions.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.name} ({w.code}) — {w.type}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par tracking ou boutique..." className="pl-10 h-12 text-lg" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="in_stock">En stock</SelectItem>
            <SelectItem value="in_transit">En transfert</SelectItem>
            <SelectItem value="misrouted">Mal dirigé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {parcels.length > 0 && canTransfer && (
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Checkbox checked={selected.size > 0 && selected.size === parcels.filter(p => p.transfer_status === 'in_stock').length} onCheckedChange={toggleAll} />
            <span className="text-sm text-muted-foreground">{selected.size} / {parcels.length} sélectionné(s)</span>
          </div>
          <Button onClick={handleTransfer} disabled={!destinationId || selected.size === 0 || transferring}>
            {transferring ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ArrowRightLeft className="w-4 h-4 mr-2" />}
            Transférer ({selected.size})
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {parcels.map((p) => (
          <Card
            key={p.id}
            className={`cursor-pointer transition-all ${selected.has(p.id) ? 'ring-2 ring-primary' : 'hover:ring-1 hover:ring-primary/30'} ${p.transfer_status === 'misrouted' ? 'border-destructive/50 bg-destructive/5' : ''}`}
            onClick={() => p.transfer_status === 'in_stock' && canTransfer && toggleSelect(p.id)}
          >
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                {canTransfer && (
                  <Checkbox
                    checked={selected.has(p.id)}
                    disabled={p.transfer_status !== 'in_stock'}
                    onCheckedChange={() => toggleSelect(p.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-sm font-medium truncate">{p.tracking}</p>
                    <CopyTrackingButton tracking={p.tracking} />
                    {p.is_multi_part && (
                      <Badge variant="outline" className="text-xs font-mono">{p.part_number}/{p.total_parts}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {p.boutique && <span className="font-medium text-foreground/80">{p.boutique}</span>}
                    {p.box_name && <span>📦 {p.box_name}</span>}
                  </div>
                </div>
                {getTransferBadge(p)}
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
