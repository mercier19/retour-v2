import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Package, BoxIcon, AlertTriangle, TrendingUp, Wrench, ClipboardCheck, Bell } from 'lucide-react';
import { Box } from '@/types/database';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface MisroutedParcel {
  id: string;
  tracking: string;
  destination_warehouse_id: string | null;
  misrouted_at_warehouse_id: string | null;
  boutique: string | null;
}

const Dashboard: React.FC = () => {
  const { warehouseId, warehouseIds, showAll } = useWarehouseFilter();
  const [totalParcels, setTotalParcels] = useState(0);
  const [totalBoxes, setTotalBoxes] = useState(0);
  const [missingCount, setMissingCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [boxes, setBoxes] = useState<(Box & { parcel_count: number })[]>([]);
  const [misroutedParcels, setMisroutedParcels] = useState<MisroutedParcel[]>([]);
  const [warehouseNames, setWarehouseNames] = useState<Record<string, string>>({});
  const [nextInventory, setNextInventory] = useState<{ id: string; scheduled_date: string; status: string } | null>(null);
  const [inventoryNotifications, setInventoryNotifications] = useState<{ id: string; type: string; message: string }[]>([]);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [selectedMisrouted, setSelectedMisrouted] = useState<MisroutedParcel | null>(null);
  const [acceptHere, setAcceptHere] = useState(true);
  const [targetBoxId, setTargetBoxId] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (warehouseIds.length === 0) return;
    loadStats();
    loadMisroutedParcels();
    loadNextInventory();
    loadInventoryNotifications();
  }, [warehouseId, showAll, warehouseIds.length]);

  useEffect(() => {
    loadWarehouseNames();
  }, []);

  const applyWarehouseFilter = (query: any) => {
    if (showAll) {
      return query.in('warehouse_id', warehouseIds);
    }
    return query.eq('warehouse_id', warehouseId);
  };

  const loadWarehouseNames = async () => {
    const { data } = await supabase.from('warehouses').select('id, name');
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((w: any) => { map[w.id] = w.name; });
      setWarehouseNames(map);
    }
  };

  const loadMisroutedParcels = async () => {
    if (warehouseIds.length === 0) return;
    const targetIds = showAll ? warehouseIds : [warehouseId!];
    const { data } = await (supabase.rpc as any)('get_misrouted_parcels_at_warehouse', {
      p_warehouse_ids: targetIds,
    });
    setMisroutedParcels((data as MisroutedParcel[]) || []);
  };

  const loadNextInventory = async () => {
    if (warehouseIds.length === 0) return;
    const targetIds = showAll ? warehouseIds : [warehouseId!];
    const { data } = await supabase
      .from('scheduled_inventories')
      .select('id, scheduled_date, status')
      .in('warehouse_id', targetIds)
      .in('status', ['pending', 'overdue'])
      .order('scheduled_date', { ascending: true })
      .limit(1);
    setNextInventory((data as any)?.[0] || null);
  };

  const loadInventoryNotifications = async () => {
    const { data } = await supabase
      .from('inventory_notifications')
      .select('id, type, message')
      .eq('read', false)
      .eq('dismissed', false)
      .order('created_at', { ascending: false })
      .limit(5);
    setInventoryNotifications((data as any[]) || []);
  };

  const dismissNotification = async (id: string) => {
    await supabase.from('inventory_notifications').update({ dismissed: true } as any).eq('id', id);
    setInventoryNotifications(prev => prev.filter(n => n.id !== id));
  };

  const loadStats = async () => {
    if (warehouseIds.length === 0) return;

    const [parcelsRes, boxesRes, missingRes, todayRes] = await Promise.all([
      applyWarehouseFilter(supabase.from('parcels').select('id', { count: 'exact', head: true })),
      applyWarehouseFilter(supabase.from('boxes').select('*')),
      applyWarehouseFilter(supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('is_missing', true)),
      applyWarehouseFilter(supabase.from('parcels').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0])),
    ]);

    setTotalParcels(parcelsRes.count || 0);
    setTotalBoxes(boxesRes.data?.length || 0);
    setMissingCount(missingRes.count || 0);
    setTodayCount(todayRes.count || 0);

    if (boxesRes.data) {
      const boxesWithCounts = await Promise.all(
        (boxesRes.data as Box[]).map(async (box) => {
          const { count } = await supabase
            .from('parcels')
            .select('id', { count: 'exact', head: true })
            .eq('box_id', box.id);
          return { ...box, parcel_count: count || 0 };
        })
      );
      setBoxes(boxesWithCounts);
    }
  };

  const handleResolveMisroute = async () => {
    if (!selectedMisrouted || !warehouseId) return;
    setResolving(true);

    const { error } = await (supabase.rpc as any)('resolve_misrouted_parcel', {
      p_parcel_id: selectedMisrouted.id,
      p_current_warehouse_id: warehouseId,
      p_box_id: acceptHere ? targetBoxId : null,
      p_accept_in_current: acceptHere,
    });

    if (error) {
      toast.error('Erreur : ' + error.message);
    } else {
      toast.success(acceptHere ? 'Colis accepté dans ce dépôt' : 'Colis renvoyé vers sa destination');
      setShowResolveModal(false);
      loadMisroutedParcels();
      loadStats();
    }
    setResolving(false);
  };

  const openResolveModal = (parcel: MisroutedParcel) => {
    setSelectedMisrouted(parcel);
    setAcceptHere(true);
    setTargetBoxId('');
    setShowResolveModal(true);
  };

  const stats = [
    { label: 'Total Colis', value: totalParcels, icon: Package, color: 'text-primary' },
    { label: 'Boxes', value: totalBoxes, icon: BoxIcon, color: 'text-accent' },
    { label: 'Manquants', value: missingCount, icon: AlertTriangle, color: 'text-destructive' },
    { label: "Aujourd'hui", value: todayCount, icon: TrendingUp, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Tableau de bord
        {showAll && <span className="text-sm font-normal text-muted-foreground ml-2">(Tous les dépôts)</span>}
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                </div>
                <stat.icon className={`w-8 h-8 ${stat.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {missingCount > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <p className="text-sm font-medium">{missingCount} colis manquant(s) détecté(s)</p>
          </CardContent>
        </Card>
      )}

      {/* Misrouted parcels section */}
      {misroutedParcels.length > 0 && (
        <Card className="border-orange-500/50 bg-orange-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Wrench className="w-5 h-5 text-orange-500" />
              {misroutedParcels.length} colis mal dirigé(s)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {misroutedParcels.map((parcel) => (
                <div key={parcel.id} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50">
                  <div>
                    <p className="font-mono text-sm font-medium">{parcel.tracking}</p>
                    <p className="text-xs text-muted-foreground">
                      Destination : {warehouseNames[parcel.destination_warehouse_id || ''] || 'Inconnue'}
                      {parcel.boutique && ` • ${parcel.boutique}`}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => openResolveModal(parcel)}>
                    <Wrench className="w-3 h-3 mr-1" /> Corriger
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Boxes {showAll ? 'de tous les dépôts' : 'du dépôt'}</CardTitle>
        </CardHeader>
        <CardContent>
          {boxes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune box</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {boxes.map((box) => (
                <div key={box.id} className="p-3 rounded-lg bg-secondary/50 border border-border/50">
                  <p className="font-medium text-sm">{box.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {box.parcel_count} colis {box.quota ? `/ ${box.quota}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resolve misrouted modal */}
      <Dialog open={showResolveModal} onOpenChange={setShowResolveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Résoudre le colis mal dirigé</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Tracking : <span className="font-mono font-medium">{selectedMisrouted?.tracking}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Destination prévue : {warehouseNames[selectedMisrouted?.destination_warehouse_id || ''] || 'Inconnue'}
            </p>

            <RadioGroup value={acceptHere ? 'accept' : 'resend'} onValueChange={(v) => setAcceptHere(v === 'accept')}>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="accept" id="accept" />
                <Label htmlFor="accept">Accepter ici (devient stock)</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="resend" id="resend" />
                <Label htmlFor="resend">Renvoyer vers la destination</Label>
              </div>
            </RadioGroup>

            {acceptHere && (
              <div>
                <Label>Choisir une boîte</Label>
                <Select value={targetBoxId} onValueChange={setTargetBoxId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une boîte" />
                  </SelectTrigger>
                  <SelectContent>
                    {boxes.map((b) => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowResolveModal(false)}>Annuler</Button>
              <Button onClick={handleResolveMisroute} disabled={resolving || (acceptHere && !targetBoxId)}>
                {resolving ? 'En cours...' : 'Confirmer'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
