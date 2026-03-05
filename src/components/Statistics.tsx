import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['hsl(215, 90%, 42%)', 'hsl(38, 95%, 55%)', 'hsl(142, 72%, 40%)', 'hsl(0, 72%, 51%)', 'hsl(280, 60%, 50%)'];

const Statistics: React.FC = () => {
  const { warehouseId } = useWarehouseFilter();
  const [boutiqueData, setBoutiqueData] = useState<{ name: string; count: number }[]>([]);
  const [wilayaData, setWilayaData] = useState<{ name: string; count: number }[]>([]);
  const [statusData, setStatusData] = useState<{ name: string; value: number }[]>([]);
  const [totalParcels, setTotalParcels] = useState(0);
  const [totalGiven, setTotalGiven] = useState(0);

  useEffect(() => {
    if (warehouseId) loadStats();
  }, [warehouseId]);

  const loadStats = async () => {
    if (!warehouseId) return;

    const { data: parcels } = await supabase.from('parcels').select('*').eq('warehouse_id', warehouseId);
    if (!parcels) return;

    setTotalParcels(parcels.length);
    setTotalGiven(parcels.filter((p) => p.status === 'given').length);

    // Top boutiques
    const boutiques: Record<string, number> = {};
    parcels.forEach((p) => { if (p.boutique) boutiques[p.boutique] = (boutiques[p.boutique] || 0) + 1; });
    setBoutiqueData(
      Object.entries(boutiques)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))
    );

    // Top wilayas
    const wilayas: Record<string, number> = {};
    parcels.forEach((p) => { if (p.wilaya) wilayas[p.wilaya] = (wilayas[p.wilaya] || 0) + 1; });
    setWilayaData(
      Object.entries(wilayas)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }))
    );

    // Status distribution
    const statuses: Record<string, number> = {};
    parcels.forEach((p) => {
      const s = p.is_missing ? 'Manquant' : p.status === 'given' ? 'Donné' : 'En stock';
      statuses[s] = (statuses[s] || 0) + 1;
    });
    setStatusData(Object.entries(statuses).map(([name, value]) => ({ name, value })));
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Statistiques</h1>

      <div className="grid grid-cols-2 gap-4">
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{totalParcels}</p>
            <p className="text-sm text-muted-foreground">Total colis</p>
          </CardContent>
        </Card>
        <Card className="glass-card">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-success">{totalGiven}</p>
            <p className="text-sm text-muted-foreground">Donnés</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Distribution des statuts</CardTitle></CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-8">Pas de données</p>}
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader><CardTitle className="text-lg">Top Boutiques</CardTitle></CardHeader>
          <CardContent>
            {boutiqueData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={boutiqueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(215, 90%, 42%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-8">Pas de données</p>}
          </CardContent>
        </Card>

        <Card className="glass-card lg:col-span-2">
          <CardHeader><CardTitle className="text-lg">Top Wilayas</CardTitle></CardHeader>
          <CardContent>
            {wilayaData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={wilayaData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="hsl(38, 95%, 55%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <p className="text-muted-foreground text-center py-8">Pas de données</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Statistics;
