import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, AlertTriangle, HandCoins, CheckSquare, XSquare, ChevronsUpDown, Check, ArrowRightLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Box, Warehouse } from '@/types/database';
import ParcelHistoryDialog from '@/components/ParcelHistoryDialog';
import CopyTrackingButton from '@/components/CopyTrackingButton';

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
  transfer_status: string | null;
  destination_warehouse_id: string | null;
  misrouted_at_warehouse_id: string | null;
}

const DonnerRetours: React.FC = () => {
  const { warehouseId, warehouseIds, showAll, hasRole, currentWarehouse } = useWarehouseFilter();
  const { user, warehouses: userWarehouses } = useAuth();
  const [parcels, setParcels] = useState<ParcelWithDetails[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [searchMode, setSearchMode] = useState<'tracking' | 'boutique'>('boutique');
  const [boutiques, setBoutiques] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [boxTransferParcelId, setBoxTransferParcelId] = useState<string | null>(null);
  const [transferFilter, setTransferFilter] = useState<string>('all');

  // Transfer modal state
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferParcelIds, setTransferParcelIds] = useState<string[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [transferring, setTransferring] = useState(false);

  // History modal
  const [historyParcel, setHistoryParcel] = useState<ParcelWithDetails | null>(null);

  const canTransfer = hasRole('chef_agence', 'regional', 'super_admin');

  const loadAllWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('name');
    setAllWarehouses((data as Warehouse[]) || []);
  };

  const loadBoxes = async () => {
    const ids = showAll ? warehouseIds : warehouseId ? [warehouseId] : [];
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('boxes')
      .select('*')
      .in('warehouse_id', ids)
      .order('name');
    setBoxes((data as Box[]) || []);
  };

  const handleBoxTransfer = async (parcelId: string, newBoxId: string) => {
    const parcel = parcels.find(p => p.id === parcelId);
    if (!parcel) return;

    const targetBox = boxes.find(b => b.id === newBoxId);
    if (targetBox && targetBox.quota && targetBox.quota > 0) {
      const { count } = await supabase
        .from('parcels')
        .select('id', { count: 'exact', head: true })
        .eq('box_id', newBoxId)
        .eq('status', 'in_stock');
      if (count !== null && count >= targetBox.quota) {
        toast.error(`La box "${targetBox.name}" est pleine (${targetBox.quota}/${targetBox.quota})`);
        return;
      }
    }

    const { error } = await supabase
      .from('parcels')
      .update({ box_id: newBoxId })
      .eq('id', parcelId);

    if (error) { toast.error(error.message); return; }

    const newBoxName = targetBox?.name || null;
    setParcels(prev => prev.map(p => p.id === parcelId ? { ...p, box_id: newBoxId, box_name: newBoxName } : p));
    toast.success(`Colis déplacé vers ${newBoxName}`);
    setBoxTransferParcelId(null);
  };

  const loadParcels = async (query: string) => {
    if (!warehouseId && !showAll || !query.trim()) { setParcels([]); return; }

    setLoading(true);
    let dbQuery = supabase
      .from('parcels')
      .select('id, tracking, boutique, box_id, is_missing, created_at, warehouse_id, status, added_by, is_multi_part, part_number, total_parts, transfer_status, destination_warehouse_id, misrouted_at_warehouse_id, boxes(name), profiles:added_by(full_name)')
      .eq('status', 'in_stock');

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

    if (transferFilter === 'in_transit') dbQuery = dbQuery.eq('transfer_status', 'in_transit');
    else if (transferFilter === 'misrouted') dbQuery = dbQuery.eq('transfer_status', 'misrouted');
    else if (transferFilter === 'in_stock_only') dbQuery = dbQuery.eq('transfer_status', 'in_stock');

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
        total_parts: p.total_parts ?? 1,
        transfer_status: p.transfer_status ?? 'in_stock',
        destination_warehouse_id: p.destination_warehouse_id,
        misrouted_at_warehouse_id: p.misrouted_at_warehouse_id ?? null,
      })));
    }
    setLoading(false);
  };

  const loadBoutiques = async () => {
    const ids = showAll ? warehouseIds : warehouseId ? [warehouseId] : [];
    if (ids.length === 0) return;
    const { data } = await supabase
      .from('parcels')
      .select('boutique')
      .eq('status', 'in_stock')
      .in('warehouse_id', ids)
      .not('boutique', 'is', null);
    const unique = Array.from(new Set((data || []).map((p: any) => p.boutique).filter(Boolean))).sort() as string[];
    setBoutiques(unique);
  };

  useEffect(() => {
    loadBoutiques();
    loadBoxes();
    loadAllWarehouses();
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
  }, [search, searchMode, warehouseId, showAll, transferFilter]);

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

    const { error: givenError } = await supabase
      .from('parcels')
      .update({ status: 'given', given_at: new Date().toISOString() })
      .in('id', Array.from(selected));

    if (givenError) { toast.error(givenError.message); return; }

    if (unselectedIds.length > 0) {
      await supabase
        .from('parcels')
        .update({ is_missing: true })
        .in('id', unselectedIds);
    }

    // Open Yalidine returns page if boutique mapping exists
    const boutiqueName = search;
    if (boutiqueName) {
      // Resolve warehouse code: use currentWarehouse or look up from first selected parcel
      let whCode = currentWarehouse?.code;
      if (!whCode) {
        const firstParcel = parcels.find(p => selected.has(p.id));
        if (firstParcel) {
          const wh = allWarehouses.find(w => w.id === firstParcel.warehouse_id);
          whCode = wh?.code;
        }
      }

      const { data: mapping } = await supabase
        .from('boutique_mappings')
        .select('external_id')
        .eq('name', boutiqueName)
        .maybeSingle();

      if (mapping?.external_id && whCode) {
        const url = `https://yalidine.app/app/sac/remettre_retour.php?s=${mapping.external_id}&hi=${whCode}`;
        window.open(url, '_blank');
      } else if (!mapping?.external_id) {
        toast.warning('Lien Yalidine non disponible (ID boutique manquant)');
      } else {
        toast.warning('Code agence introuvable');
      }
    }

    toast.success(`${selected.size} colis donné(s)${unselectedIds.length > 0 ? `, ${unselectedIds.length} marqué(s) manquant(s)` : ''}`);
    setSelected(new Set());
    setSearch('');
    setParcels([]);
  };

  // Transfer logic
  const openTransferModal = (parcelIds: string[]) => {
    setTransferParcelIds(parcelIds);
    setDestinationId('');
    setTransferModalOpen(true);
  };

  const handleTransfer = async () => {
    if (!destinationId || transferParcelIds.length === 0 || !user) return;
    setTransferring(true);

    const destWh = allWarehouses.find(w => w.id === destinationId);

    const { error } = await supabase
      .from('parcels')
      .update({
        transfer_status: 'in_transit',
        destination_warehouse_id: destinationId,
        transfer_initiated_at: new Date().toISOString(),
      })
      .in('id', transferParcelIds);

    if (error) {
      toast.error(error.message);
      setTransferring(false);
      return;
    }

    const historyRecords = transferParcelIds.map(pid => {
      const parcel = parcels.find(p => p.id === pid);
      return {
        parcel_id: pid,
        from_warehouse_id: parcel?.warehouse_id || warehouseId!,
        to_warehouse_id: destinationId,
        initiated_by: user.id,
        status: 'pending',
      };
    });

    await supabase.from('transfer_history').insert(historyRecords);

    toast.success(`${transferParcelIds.length} colis transféré(s) vers ${destWh?.name || 'destination'}`);
    setTransferModalOpen(false);
    setTransferring(false);

    // Update UI
    setParcels(prev => prev.map(p =>
      transferParcelIds.includes(p.id)
        ? { ...p, transfer_status: 'in_transit', destination_warehouse_id: destinationId }
        : p
    ));
    setSelected(new Set());
  };

  const getWarehouseName = (id: string | null) => allWarehouses.find(w => w.id === id)?.name || '?';

  const destinationOptions = allWarehouses.filter(w => showAll || w.id !== warehouseId);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getTransferBadge = (parcel: ParcelWithDetails) => {
    if (parcel.transfer_status === 'in_transit') {
      return <Badge variant="secondary" className="bg-amber-500/20 text-amber-700 border-amber-300 text-[10px]">En transfert → {getWarehouseName(parcel.destination_warehouse_id)}</Badge>;
    }
    if (parcel.transfer_status === 'misrouted') {
      return (
        <div className="flex flex-col items-end gap-0.5">
          <Badge variant="destructive" className="text-[10px]">Faux dispatch</Badge>
          {parcel.misrouted_at_warehouse_id && (
            <span className="text-[10px] text-destructive">vers {getWarehouseName(parcel.misrouted_at_warehouse_id)}</span>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Remettre des retours</h1>
        <div className="flex items-center gap-2">
          {canTransfer && selected.size > 0 && (
            <Button variant="outline" onClick={() => openTransferModal(Array.from(selected))}>
              <ArrowRightLeft className="w-4 h-4 mr-1" /> Transférer ({selected.size})
            </Button>
          )}
          {selected.size > 0 && (
            <Button onClick={markGiven}>
              <HandCoins className="w-4 h-4 mr-1" /> Donner ({selected.size})
            </Button>
          )}
        </div>
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex gap-2 items-center mb-3 flex-wrap">
            <Button
              variant={searchMode === 'boutique' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSearchMode('boutique'); setSearch(''); setParcels([]); setSelected(new Set()); }}>
              Par boutique
            </Button>
            <Button
              variant={searchMode === 'tracking' ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setSearchMode('tracking'); setSearch(''); setParcels([]); setSelected(new Set()); }}>
              Par tracking
            </Button>
            <Select value={transferFilter} onValueChange={setTransferFilter}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                <SelectItem value="in_stock_only">En stock</SelectItem>
                <SelectItem value="in_transit">En transfert</SelectItem>
                <SelectItem value="misrouted">Mal dirigé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {searchMode === 'boutique' ? (
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
                      {boutiques.map((b) => (
                        <CommandItem key={b} value={b} onSelect={() => { setSearch(b); setOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", search === b ? "opacity-100" : "opacity-0")} />
                          {b}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par tracking..." className="pl-9" autoFocus />
            </div>
          )}
        </CardContent>
      </Card>

      {parcels.length > 0 && (
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
      )}

      {loading && <p className="text-muted-foreground text-center py-4">Chargement...</p>}

      <div className="space-y-1">
        {parcels.map((parcel) => (
          <Card key={parcel.id} className={`glass-card ${parcel.is_missing ? 'border-destructive/50 bg-destructive/5' : ''} ${parcel.transfer_status === 'in_transit' ? 'border-amber-300/50 bg-amber-500/5' : ''}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox checked={selected.has(parcel.id)} onCheckedChange={() => toggleSelect(parcel.id)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-mono text-sm font-medium truncate">{parcel.tracking}</p>
                  <CopyTrackingButton tracking={parcel.tracking} />
                  {parcel.is_multi_part && (
                    <Badge variant="outline" className="text-xs font-mono">{parcel.part_number}/{parcel.total_parts}</Badge>
                  )}
                  {parcel.is_missing && (
                    <span className="text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded">manquant</span>
                  )}
                  {getTransferBadge(parcel)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  {parcel.boutique && <span className="font-medium text-foreground/80">{parcel.boutique}</span>}
                  {parcel.box_name && <span>📦 {parcel.box_name}</span>}
                  <span>🕐 {formatDate(parcel.created_at)}</span>
                  {parcel.added_by_name && <span>👤 {parcel.added_by_name}</span>}
                </div>
              </div>

              {/* History button */}
              <Button size="sm" variant="ghost" onClick={() => setHistoryParcel(parcel)} title="Historique">
                <Clock className="w-4 h-4 text-muted-foreground" />
              </Button>

              {/* Transfer button (single parcel) */}
              {canTransfer && parcel.transfer_status === 'in_stock' && (
                <Button size="sm" variant="ghost" onClick={() => openTransferModal([parcel.id])} title="Transférer">
                  <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
                </Button>
              )}

              {/* Box transfer popover */}
              <Popover open={boxTransferParcelId === parcel.id} onOpenChange={(o) => setBoxTransferParcelId(o ? parcel.id : null)}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="ghost" onClick={(e) => e.stopPropagation()} title="Changer de box">
                    📦
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0" align="end" onClick={(e) => e.stopPropagation()}>
                  <Command>
                    <CommandInput placeholder="Box..." />
                    <CommandList>
                      <CommandEmpty>Aucune box</CommandEmpty>
                      <CommandGroup>
                        {boxes.filter(b => b.warehouse_id === parcel.warehouse_id).map((box) => (
                          <CommandItem key={box.id} value={box.name} disabled={box.id === parcel.box_id} onSelect={() => handleBoxTransfer(parcel.id, box.id)}>
                            <Check className={cn("mr-2 h-4 w-4", parcel.box_id === box.id ? "opacity-100" : "opacity-0")} />
                            {box.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              <a
                href={`https://yalidine.app/app/colis/index.php?source=cec&column=tracking&q=${encodeURIComponent(parcel.tracking)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-block hover:opacity-75 transition-opacity shrink-0"
                title="Voir sur Yalidine"
              >
                <img src="/yalidine-logo.png" alt="Yalidine" className="w-5 h-5" />
              </a>

              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const { error } = await supabase.from('parcels').update({ is_missing: !parcel.is_missing }).eq('id', parcel.id);
                  if (error) toast.error(error.message); else {
                    setParcels((prev) => prev.map((p) => p.id === parcel.id ? { ...p, is_missing: !p.is_missing } : p));
                    toast.success(parcel.is_missing ? 'Marqué trouvé' : 'Marqué manquant');
                  }
                }}
                title={parcel.is_missing ? 'Marquer trouvé' : 'Marquer manquant'}
              >
                <AlertTriangle className={`w-4 h-4 ${parcel.is_missing ? 'text-destructive' : 'text-muted-foreground'}`} />
              </Button>
            </CardContent>
          </Card>
        ))}

        {search && !loading && parcels.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucun colis trouvé</p>
        )}

        {!search && (
          <p className="text-muted-foreground text-center py-8">
            {searchMode === 'boutique' ? 'Sélectionnez une boutique pour afficher les colis' : 'Tapez au moins 2 caractères pour rechercher'}
          </p>
        )}
      </div>

      {/* Transfer modal */}
      <Dialog open={transferModalOpen} onOpenChange={setTransferModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transférer {transferParcelIds.length} colis</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Destination</label>
              <Select value={destinationId} onValueChange={setDestinationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une destination..." />
                </SelectTrigger>
                <SelectContent>
                  {destinationOptions.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name} — {w.type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferModalOpen(false)}>Annuler</Button>
            <Button onClick={handleTransfer} disabled={!destinationId || transferring}>
              <ArrowRightLeft className="w-4 h-4 mr-1" />
              {transferring ? 'Transfert...' : 'Initier le transfert'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History popup */}
      <ParcelHistoryDialog
        open={!!historyParcel}
        onOpenChange={(o) => !o && setHistoryParcel(null)}
        parcel={historyParcel}
      />
    </div>
  );
};

export default DonnerRetours;
