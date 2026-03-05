import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, BoxIcon, AlertTriangle, TrendingUp } from 'lucide-react';
import { Box, Parcel } from '@/types/database';

const Dashboard: React.FC = () => {
  const { warehouseId } = useWarehouseFilter();
  const [totalParcels, setTotalParcels] = useState(0);
  const [totalBoxes, setTotalBoxes] = useState(0);
  const [missingCount, setMissingCount] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [boxes, setBoxes] = useState<(Box & { parcel_count: number })[]>([]);

  useEffect(() => {
    if (!warehouseId) return;
    loadStats();
  }, [warehouseId]);

  const loadStats = async () => {
    if (!warehouseId) return;

    const [parcelsRes, boxesRes, missingRes, todayRes] = await Promise.all([
      supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('warehouse_id', warehouseId),
      supabase.from('boxes').select('*').eq('warehouse_id', warehouseId),
      supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('warehouse_id', warehouseId).eq('is_missing', true),
      supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('warehouse_id', warehouseId).gte('created_at', new Date().toISOString().split('T')[0]),
    ]);

    setTotalParcels(parcelsRes.count || 0);
    setTotalBoxes(boxesRes.data?.length || 0);
    setMissingCount(missingRes.count || 0);
    setTodayCount(todayRes.count || 0);

    // Load box parcel counts
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

  const stats = [
    { label: 'Total Colis', value: totalParcels, icon: Package, color: 'text-primary' },
    { label: 'Boîtes', value: totalBoxes, icon: BoxIcon, color: 'text-accent' },
    { label: 'Manquants', value: missingCount, icon: AlertTriangle, color: 'text-destructive' },
    { label: "Aujourd'hui", value: todayCount, icon: TrendingUp, color: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tableau de bord</h1>

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

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Boîtes du dépôt</CardTitle>
        </CardHeader>
        <CardContent>
          {boxes.length === 0 ? (
            <p className="text-muted-foreground text-sm">Aucune boîte dans ce dépôt</p>
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
    </div>
  );
};

export default Dashboard;
