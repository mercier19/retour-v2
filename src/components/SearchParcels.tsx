import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, AlertTriangle } from 'lucide-react';

interface ParcelResult {
  id: string;
  tracking: string;
  boutique: string | null;
  box_name: string | null;
  status: string | null;
  is_missing: boolean | null;
  is_multi_part: boolean;
  part_number: number;
  total_parts: number;
}

interface StatusLog {
  id: string;
  status: string;
  created_at: string;
  changed_by_name: string | null;
  warehouse_name: string | null;
}

const statusLabel = (s: string) => {
  if (s === 'in_stock') return 'En stock';
  if (s === 'given') return 'Donné';
  if (s === 'missing') return 'Manquant';
  if (s === 'found') return 'Trouvé';
  if (s.startsWith('Transfert vers')) return s;
  return s;
};

const SearchParcels: React.FC = () => {
  const { warehouseId, warehouseIds, showAll } = useWarehouseFilter();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ParcelResult[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<ParcelResult | null>(null);
  const [logs, setLogs] = useState<StatusLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [showMissing, setShowMissing] = useState(false);
  const [missingParcels, setMissingParcels] = useState<ParcelResult[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);

  useEffect(() => {
    if ((!warehouseId && !showAll) || !search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId, showAll]);

  useEffect(() => {
    if (showMissing) loadMissingParcels();
  }, [showMissing, warehouseId, showAll]);

  const mapParcel = (p: any): ParcelResult => ({
    id: p.id,
    tracking: p.tracking,
    boutique: p.boutique,
    box_name: p.boxes?.name || null,
    status: p.status,
    is_missing: p.is_missing,
    is_multi_part: p.is_multi_part ?? false,
    part_number: p.part_number ?? 1,
    total_parts: p.total_parts ?? 1,
  });

  const doSearch = async () => {
    if ((!warehouseId && !showAll) || !search.trim()) return;
    const s = search.trim();
    let query = supabase
      .from('parcels')
      .select('id, tracking, boutique, status, is_missing, is_multi_part, part_number, total_parts, boxes(name)')
      .or(`tracking.ilike.%${s}%,boutique.ilike.%${s}%`)
      .order('tracking')
      .order('part_number')
      .limit(50);

    if (showAll) {
      query = query.in('warehouse_id', warehouseIds);
    } else {
      query = query.eq('warehouse_id', warehouseId!);
    }

    const { data } = await query;
    setResults((data || []).map(mapParcel));
  };

  const loadMissingParcels = async () => {
    if (!warehouseId && !showAll) return;
    setMissingLoading(true);
    let query = supabase
      .from('parcels')
      .select('id, tracking, boutique, status, is_missing, is_multi_part, part_number, total_parts, boxes(name)')
      .eq('is_missing', true)
      .order('tracking')
      .order('part_number')
      .limit(200);

    if (showAll) {
      query = query.in('warehouse_id', warehouseIds);
    } else {
      query = query.eq('warehouse_id', warehouseId!);
    }

    const { data } = await query;
    setMissingParcels((data || []).map(mapParcel));
    setMissingLoading(false);
  };

  const openHistory = async (parcel: ParcelResult) => {
    setSelectedParcel(parcel);
    setLogsLoading(true);
    const { data } = await supabase
      .from('parcel_status_log')
      .select('id, status, created_at, profiles:changed_by(full_name), warehouses:warehouse_id(name)')
      .eq('parcel_id', parcel.id)
      .order('created_at', { ascending: true });

    setLogs(
      (data || []).map((l: any) => ({
        id: l.id,
        status: l.status,
        created_at: l.created_at,
        changed_by_name: l.profiles?.full_name || null,
        warehouse_name: l.warehouses?.name || null,
      }))
    );
    setLogsLoading(false);
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });

  const displayList = showMissing ? missingParcels : results;

  const PartBadge = ({ parcel }: { parcel: ParcelResult }) => {
    if (!parcel.is_multi_part) return null;
    return (
      <Badge variant="outline" className="text-xs font-mono ml-1">
        {parcel.part_number}/{parcel.total_parts}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">Rechercher</h1>
        <Button
          variant={showMissing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowMissing(!showMissing)}
        >
          <AlertTriangle className="w-4 h-4 mr-1" />
          Manquants {showMissing && missingParcels.length > 0 ? `(${missingParcels.length})` : ''}
        </Button>
      </div>

      {!showMissing && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tracking ou boutique..."
            className="pl-10 h-12 text-lg"
          />
        </div>
      )}

      {showMissing && missingLoading && (
        <p className="text-muted-foreground text-center py-4">Chargement...</p>
      )}

      <div className="space-y-2">
        {displayList.map((p) => (
          <Card
            key={p.id}
            className={`glass-card cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all ${p.is_missing ? 'border-destructive/50' : ''}`}
            onClick={() => openHistory(p)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <p className="font-mono text-sm font-medium truncate">{p.tracking}</p>
                    <PartBadge parcel={p} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {p.boutique && <span className="font-medium text-foreground/80">{p.boutique}</span>}
                    {p.box_name && <span>📦 {p.box_name}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2">
                  <a
                    href={`https://yalidine.app/app/colis/index.php?source=cec&column=tracking&q=${encodeURIComponent(p.tracking)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-block hover:opacity-75 transition-opacity"
                    title="Voir sur Yalidine"
                  >
                    <img src="/yalidine-logo.png" alt="Yalidine" className="w-5 h-5" />
                  </a>
                  {p.is_missing && <Badge variant="destructive">Manquant</Badge>}
                  <Badge variant={p.status === 'given' ? 'secondary' : 'default'}>
                    {statusLabel(p.status || 'in_stock')}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {!showMissing && search && results.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucun résultat</p>
        )}
        {showMissing && !missingLoading && missingParcels.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucun colis manquant</p>
        )}
      </div>

      {/* History Dialog */}
      <Dialog open={!!selectedParcel} onOpenChange={(open) => !open && setSelectedParcel(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-sm">{selectedParcel?.tracking}</span>
              {selectedParcel?.is_multi_part && (
                <Badge variant="outline" className="text-xs font-mono">
                  Partie {selectedParcel.part_number}/{selectedParcel.total_parts}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              {selectedParcel?.boutique && <span>{selectedParcel.boutique}</span>}
              {selectedParcel?.box_name && <span>📦 {selectedParcel.box_name}</span>}
            </div>
          </DialogHeader>

          <div className="mt-4">
            <h4 className="text-sm font-semibold mb-3">Historique des statuts</h4>
            {logsLoading ? (
              <p className="text-sm text-muted-foreground text-center py-4">Chargement...</p>
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucun historique disponible</p>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                {logs.map((log, i) => (
                  <div key={log.id} className="relative flex items-start gap-3 pb-4">
                    <div className={`relative z-10 w-[15px] h-[15px] rounded-full border-2 mt-0.5 shrink-0 ${
                      i === logs.length - 1
                        ? 'bg-primary border-primary'
                        : 'bg-background border-muted-foreground/40'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === 'given' ? 'secondary' : 'default'} className="text-xs">
                          {statusLabel(log.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span>🕐 {formatDate(log.created_at)}</span>
                        {log.warehouse_name && <span>📍 {log.warehouse_name}</span>}
                        {log.changed_by_name && <span>👤 {log.changed_by_name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchParcels;
