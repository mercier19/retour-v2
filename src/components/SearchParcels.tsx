import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';
import { Parcel } from '@/types/database';

const SearchParcels: React.FC = () => {
  const { warehouseId } = useWarehouseFilter();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Parcel[]>([]);

  useEffect(() => {
    if (!warehouseId || !search.trim()) { setResults([]); return; }
    const timer = setTimeout(() => doSearch(), 300);
    return () => clearTimeout(timer);
  }, [search, warehouseId]);

  const doSearch = async () => {
    if (!warehouseId || !search.trim()) return;
    const s = search.trim();
    const { data } = await supabase
      .from('parcels')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .or(`tracking.ilike.%${s}%,boutique.ilike.%${s}%,wilaya.ilike.%${s}%`)
      .limit(50);
    setResults((data as Parcel[]) || []);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Rechercher</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tracking, boutique ou wilaya..."
          className="pl-10 h-12 text-lg"
        />
      </div>

      <div className="space-y-2">
        {results.map((p) => (
          <Card key={p.id} className={`glass-card ${p.is_missing ? 'border-destructive/50' : ''}`}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm font-medium">{p.tracking}</p>
                  <p className="text-xs text-muted-foreground mt-1">{[p.boutique, p.wilaya, p.commune].filter(Boolean).join(' · ')}</p>
                </div>
                <div className="flex gap-1">
                  {p.is_missing && <Badge variant="destructive">Manquant</Badge>}
                  <Badge variant={p.status === 'given' ? 'secondary' : 'default'}>
                    {p.status === 'given' ? 'Donné' : 'En stock'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {search && results.length === 0 && (
          <p className="text-muted-foreground text-center py-8">Aucun résultat</p>
        )}
      </div>
    </div>
  );
};

export default SearchParcels;
