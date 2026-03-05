import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, AlertTriangle, HandCoins } from 'lucide-react';
import { Parcel } from '@/types/database';

const DonnerRetours: React.FC = () => {
  const { warehouseId } = useWarehouseFilter();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterMissing, setFilterMissing] = useState(false);

  useEffect(() => {
    if (warehouseId) loadParcels();
  }, [warehouseId, filterMissing]);

  const loadParcels = async () => {
    if (!warehouseId) return;
    let query = supabase.from('parcels').select('*').eq('warehouse_id', warehouseId).eq('status', 'in_stock');
    if (filterMissing) query = query.eq('is_missing', true);
    const { data } = await query.order('created_at', { ascending: false });
    setParcels((data as Parcel[]) || []);
  };

  const filtered = parcels.filter((p) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return p.tracking.toLowerCase().includes(s) || p.boutique?.toLowerCase().includes(s) || p.wilaya?.toLowerCase().includes(s);
  });

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const markGiven = async () => {
    if (selected.size === 0) return;
    const { error } = await supabase.from('parcels').update({ status: 'given', given_at: new Date().toISOString() }).in('id', Array.from(selected));
    if (error) toast.error(error.message);
    else { toast.success(`${selected.size} colis donné(s)`); setSelected(new Set()); loadParcels(); }
  };

  const markMissing = async (id: string) => {
    const parcel = parcels.find((p) => p.id === id);
    const { error } = await supabase.from('parcels').update({ is_missing: !parcel?.is_missing }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Statut mis à jour'); loadParcels(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Donner des retours</h1>
        {selected.size > 0 && (
          <Button onClick={markGiven}>
            <HandCoins className="w-4 h-4 mr-1" /> Donner ({selected.size})
          </Button>
        )}
      </div>

      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex gap-3 items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par tracking, boutique, wilaya..." className="pl-9" />
            </div>
            <Button variant={filterMissing ? 'destructive' : 'outline'} size="sm" onClick={() => setFilterMissing(!filterMissing)}>
              <AlertTriangle className="w-4 h-4 mr-1" /> Manquants
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-1">
        {filtered.length > 0 && (
          <div className="flex items-center gap-2 p-2">
            <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={selectAll} />
            <span className="text-sm text-muted-foreground">Tout sélectionner ({filtered.length})</span>
          </div>
        )}

        {filtered.map((parcel) => (
          <Card key={parcel.id} className={`glass-card ${parcel.is_missing ? 'border-destructive/50' : ''}`}>
            <CardContent className="p-3 flex items-center gap-3">
              <Checkbox checked={selected.has(parcel.id)} onCheckedChange={() => toggleSelect(parcel.id)} />
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium truncate">{parcel.tracking}</p>
                <p className="text-xs text-muted-foreground">{[parcel.boutique, parcel.wilaya, parcel.commune].filter(Boolean).join(' · ')}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => markMissing(parcel.id)} title={parcel.is_missing ? 'Marquer trouvé' : 'Marquer manquant'}>
                <AlertTriangle className={`w-4 h-4 ${parcel.is_missing ? 'text-destructive' : 'text-muted-foreground'}`} />
              </Button>
            </CardContent>
          </Card>
        ))}

        {filtered.length === 0 && <p className="text-muted-foreground text-center py-8">Aucun colis trouvé</p>}
      </div>
    </div>
  );
};

export default DonnerRetours;
