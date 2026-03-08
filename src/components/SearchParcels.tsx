import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, AlertTriangle } from 'lucide-react';
import ParcelHistoryDialog from '@/components/ParcelHistoryDialog';
import CopyTrackingButton from '@/components/CopyTrackingButton';

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
  warehouse_name: string | null;
  transfer_status: string | null;
  destination_warehouse_name: string | null;
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
  const [showMissing, setShowMissing] = useState(false);
  const [missingParcels, setMissingParcels] = useState<ParcelResult[]>([]);
  const [missingLoading, setMissingLoading] = useState(false);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (showMissing) loadMissingParcels();
  }, [showMissing, warehouseId, showAll]);

  const doSearch = async () => {
    if (!search.trim()) return;
    const s = search.trim();

    const rpcClient = supabase as unknown as {
      rpc: (fn: string, params?: Record<string, unknown>) => Promise<{ data: any; error: any }>;
    };

    const { data, error } = await rpcClient.rpc('search_parcels_global', { p_search: s });

    if (error) {
      console.error('Global search error:', error);
      setResults([]);
      return;
    }

    setResults(
      (data || []).map((p: any): ParcelResult => ({
        id: p.id,
        tracking: p.tracking,
        boutique: p.boutique,
        box_name: p.box_name || null,
        status: p.status,
        is_missing: p.is_missing,
        is_multi_part: p.is_multi_part ?? false,
        part_number: p.part_number ?? 1,
        total_parts: p.total_parts ?? 1,
        warehouse_name: p.warehouse_name || null,
        transfer_status: p.transfer_status || null,
        destination_warehouse_name: p.destination_warehouse_name || null,
      }))
    );
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
    setMissingParcels(
      (data || []).map((p: any): ParcelResult => ({
        id: p.id,
        tracking: p.tracking,
        boutique: p.boutique,
        box_name: p.boxes?.name || null,
        status: p.status,
        is_missing: p.is_missing,
        is_multi_part: p.is_multi_part ?? false,
        part_number: p.part_number ?? 1,
        total_parts: p.total_parts ?? 1,
        warehouse_name: null,
        transfer_status: null,
        destination_warehouse_name: null,
      }))
    );
    setMissingLoading(false);
  };

  const displayList = showMissing ? missingParcels : results;

  const PartBadge = ({ parcel }: { parcel: ParcelResult }) => {
    if (!parcel.is_multi_part) return null;
    return (
      <Badge variant="outline" className="text-xs font-mono ml-1">
        {parcel.part_number}/{parcel.total_parts}
      </Badge>
    );
  };

  const TransferBadge = ({ parcel }: { parcel: ParcelResult }) => {
    if (!parcel.transfer_status || parcel.transfer_status === 'in_stock') return null;
    if (parcel.transfer_status === 'in_transit') {
      return (
        <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200 text-xs">
          En transit {parcel.destination_warehouse_name ? `→ ${parcel.destination_warehouse_name}` : ''}
        </Badge>
      );
    }
    if (parcel.transfer_status === 'misrouted') {
      return (
        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200 text-xs">
          Faux dispatch
        </Badge>
      );
    }
    return null;
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
            onClick={() => setSelectedParcel(p)}
          >
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center">
                    <p className="font-mono text-sm font-medium truncate">{p.tracking}</p>
                    <CopyTrackingButton tracking={p.tracking} />
                    <PartBadge parcel={p} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {p.boutique && <span className="font-medium text-foreground/80">{p.boutique}</span>}
                    {p.box_name && <span>📦 {p.box_name}</span>}
                    {p.warehouse_name && (
                      <span className="text-primary/70">📍 {p.warehouse_name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-2 flex-wrap justify-end">
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
                  <TransferBadge parcel={p} />
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

      {/* History Dialog - now shared component */}
      <ParcelHistoryDialog
        open={!!selectedParcel}
        onOpenChange={(o) => !o && setSelectedParcel(null)}
        parcel={selectedParcel}
      />
    </div>
  );
};

export default SearchParcels;
