import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, Legend,
} from 'recharts';
import {
  Package, TrendingUp, TrendingDown, Store, BoxIcon, AlertTriangle,
  Clock, Calendar, Search, Filter, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { format, subDays, startOfWeek, startOfDay, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWilayaName } from '@/lib/wilayas';

const COLORS = [
  'hsl(0, 78%, 47%)', 'hsl(38, 95%, 55%)', 'hsl(142, 72%, 40%)',
  'hsl(215, 90%, 42%)', 'hsl(280, 60%, 50%)', 'hsl(190, 70%, 45%)',
  'hsl(340, 80%, 50%)', 'hsl(60, 70%, 45%)', 'hsl(160, 60%, 40%)',
  'hsl(30, 80%, 50%)',
];

interface ParcelRow {
  id: string;
  tracking: string;
  boutique: string | null;
  wilaya: string | null;
  status: string | null;
  is_missing: boolean | null;
  created_at: string;
  given_at: string | null;
  box_id: string | null;
  updated_at: string;
  delivery_type: string | null;
}

interface BoxRow {
  id: string;
  name: string;
  quota: number | null;
  warehouse_id: string;
}

const Statistics: React.FC = () => {
  const { warehouseId, warehouseIds, showAll } = useWarehouseFilter();
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [boxes, setBoxes] = useState<BoxRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | '30days'>('30days');
  const [excludeEch, setExcludeEch] = useState(true);
  const [boutiqueSearch, setBoutiqueSearch] = useState('');

  useEffect(() => {
    if (warehouseIds.length > 0) loadData();
  }, [warehouseId, showAll, warehouseIds.length]);

  const loadData = async () => {
    if (warehouseIds.length === 0) return;
    setLoading(true);

    let pQuery = supabase.from('parcels').select('id, tracking, boutique, wilaya, status, is_missing, created_at, given_at, box_id, updated_at, delivery_type');
    let bQuery = supabase.from('boxes').select('id, name, quota, warehouse_id');

    if (showAll) {
      pQuery = pQuery.in('warehouse_id', warehouseIds);
      bQuery = bQuery.in('warehouse_id', warehouseIds);
    } else if (warehouseId) {
      pQuery = pQuery.eq('warehouse_id', warehouseId);
      bQuery = bQuery.eq('warehouse_id', warehouseId);
    }

    const [{ data: pData }, { data: bData }] = await Promise.all([pQuery, bQuery]);
    setParcels((pData as ParcelRow[]) || []);
    setBoxes((bData as BoxRow[]) || []);
    setLoading(false);
  };

  // Derived data
  const today = startOfDay(new Date());
  const todayStr = format(today, 'yyyy-MM-dd');
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const yesterday = subDays(today, 1);
  const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

  const activeParcels = useMemo(() => parcels.filter(p => p.status !== 'given' && p.status !== 'cancelled'), [parcels]);
  const missingParcels = useMemo(() => activeParcels.filter(p => p.is_missing), [activeParcels]);
  const sdInStock = useMemo(() => activeParcels.filter(p => p.delivery_type !== 'HD'), [activeParcels]);
  const hdInStock = useMemo(() => activeParcels.filter(p => p.delivery_type === 'HD'), [activeParcels]);
  const addedToday = useMemo(() => parcels.filter(p => p.created_at?.startsWith(todayStr)), [parcels, todayStr]);
  const addedYesterday = useMemo(() => parcels.filter(p => p.created_at?.startsWith(yesterdayStr)), [parcels, yesterdayStr]);
  const addedThisWeek = useMemo(() => parcels.filter(p => parseISO(p.created_at) >= weekStart), [parcels, weekStart]);
  const givenToday = useMemo(() => parcels.filter(p => p.given_at?.startsWith(todayStr)), [parcels, todayStr]);
  const givenYesterday = useMemo(() => parcels.filter(p => p.given_at?.startsWith(yesterdayStr)), [parcels, yesterdayStr]);
  const givenThisWeek = useMemo(() => parcels.filter(p => p.given_at && parseISO(p.given_at) >= weekStart), [parcels, weekStart]);

  const uniqueBoutiques = useMemo(() => {
    const set = new Set<string>();
    activeParcels.forEach(p => { if (p.boutique) set.add(p.boutique); });
    return set;
  }, [activeParcels]);

  // Boxes with parcel counts
  const boxParcelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    parcels.forEach(p => { if (p.box_id && p.status !== 'given') counts[p.box_id] = (counts[p.box_id] || 0) + 1; });
    return boxes.map(b => ({ ...b, parcel_count: counts[b.id] || 0 }));
  }, [parcels, boxes]);

  const boxesOverThreshold = useMemo(() =>
    boxParcelCounts.filter(b => b.quota && b.parcel_count > b.quota).sort((a, b) => b.parcel_count - a.parcel_count),
    [boxParcelCounts]
  );

  // Activity chart - last 30 days
  const activityData = useMemo(() => {
    const days: Record<string, { date: string; added: number; given: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      days[d] = { date: format(subDays(today, i), 'dd/MM', { locale: fr }), added: 0, given: 0 };
    }
    parcels.forEach(p => {
      const cDay = p.created_at?.substring(0, 10);
      if (cDay && days[cDay]) days[cDay].added++;
      if (p.given_at) {
        const gDay = p.given_at.substring(0, 10);
        if (gDay && days[gDay]) days[gDay].given++;
      }
    });
    return Object.values(days);
  }, [parcels, today]);

  // Top wilayas (excluding ech-)
  const topWilayas = useMemo(() => {
    const filtered = excludeEch ? parcels.filter(p => !p.tracking?.toLowerCase().startsWith('ech-')) : parcels;
    const counts: Record<string, number> = {};
    filtered.forEach(p => {
      if (p.wilaya) {
        const name = getWilayaName(p.wilaya);
        counts[name] = (counts[name] || 0) + 1;
      }
    });
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count, pct: total ? ((count / total) * 100).toFixed(1) : '0' }));
  }, [parcels, excludeEch]);

  // Top boutiques
  const topBoutiques = useMemo(() => {
    const counts: Record<string, number> = {};
    activeParcels.forEach(p => { if (p.boutique) counts[p.boutique] = (counts[p.boutique] || 0) + 1; });
    let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (boutiqueSearch) entries = entries.filter(([n]) => n.toLowerCase().includes(boutiqueSearch.toLowerCase()));
    return entries.slice(0, 15).map(([name, count]) => ({ name, count }));
  }, [activeParcels, boutiqueSearch]);

  // Status distribution
  const statusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    parcels.forEach(p => {
      const s = p.is_missing ? 'Manquant' : p.status === 'given' ? 'Donné' : 'En stock';
      statuses[s] = (statuses[s] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [parcels]);

  // Quick stats
  const avgDeliveryDays = useMemo(() => {
    const delivered = parcels.filter(p => p.given_at);
    if (!delivered.length) return null;
    const totalDays = delivered.reduce((sum, p) => {
      return sum + Math.max(0, differenceInDays(parseISO(p.given_at!), parseISO(p.created_at)));
    }, 0);
    return (totalDays / delivered.length).toFixed(1);
  }, [parcels]);

  const peakHour = useMemo(() => {
    const hours: Record<number, number> = {};
    parcels.forEach(p => {
      const h = parseISO(p.created_at).getHours();
      hours[h] = (hours[h] || 0) + 1;
    });
    let maxH = 0, maxC = 0;
    Object.entries(hours).forEach(([h, c]) => { if (c > maxC) { maxH = Number(h); maxC = c; } });
    return `${String(maxH).padStart(2, '0')}:00`;
  }, [parcels]);

  const stuckParcels = useMemo(() =>
    activeParcels.filter(p => differenceInDays(today, parseISO(p.updated_at)) > 7).length,
    [activeParcels, today]
  );

  const delta = (current: number, previous: number) => {
    const diff = current - previous;
    if (diff === 0) return null;
    return { diff, positive: diff > 0 };
  };

  const DeltaBadge = ({ current, previous }: { current: number; previous: number }) => {
    const d = delta(current, previous);
    if (!d) return null;
    return (
      <span className={`inline-flex items-center text-xs font-medium gap-0.5 ${d.positive ? 'text-green-600' : 'text-red-500'}`}>
        {d.positive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        {d.positive ? '+' : ''}{d.diff}
      </span>
    );
  };

  if (loading && parcels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const sdPct = activeParcels.length > 0 ? ((sdInStock.length / activeParcels.length) * 100).toFixed(0) : '0';
  const hdPct = activeParcels.length > 0 ? ((hdInStock.length / activeParcels.length) * 100).toFixed(0) : '0';

  const kpis = [
    { label: 'Colis actifs', value: activeParcels.length, icon: Package, color: 'text-primary' },
    { label: "Ajoutés aujourd'hui", value: addedToday.length, icon: TrendingUp, color: 'text-blue-600', delta: <DeltaBadge current={addedToday.length} previous={addedYesterday.length} /> },
    { label: 'Ajoutés cette semaine', value: addedThisWeek.length, icon: Calendar, color: 'text-indigo-600' },
    { label: "Donnés aujourd'hui", value: givenToday.length, icon: TrendingDown, color: 'text-green-600', delta: <DeltaBadge current={givenToday.length} previous={givenYesterday.length} /> },
    { label: 'Donnés cette semaine', value: givenThisWeek.length, icon: Calendar, color: 'text-emerald-600' },
    { label: 'Boutiques uniques', value: uniqueBoutiques.size, icon: Store, color: 'text-amber-600' },
    { label: 'Boxes à éclater', value: boxesOverThreshold.length, icon: AlertTriangle, color: boxesOverThreshold.length > 0 ? 'text-destructive' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">
          Statistiques
          {showAll && <span className="text-sm font-normal text-muted-foreground ml-2">(Tous les dépôts)</span>}
        </h1>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="excl-ech" checked={excludeEch} onCheckedChange={setExcludeEch} />
            <Label htmlFor="excl-ech" className="text-xs whitespace-nowrap">Exclure ech-</Label>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="glass-card">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <p className="text-xl font-bold">{kpi.value.toLocaleString()}</p>
                    {kpi.delta}
                  </div>
                </div>
                <kpi.icon className={`w-5 h-5 ${kpi.color} opacity-70 shrink-0`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* SD vs HD Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-2 gap-3 max-w-md">
        <Card className="glass-card border-l-4 border-l-blue-500">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">SD en stock</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <p className="text-xl font-bold">{sdInStock.length.toLocaleString()}</p>
                  <span className="text-xs text-muted-foreground">{sdPct}%</span>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-blue-500/10 text-blue-600 shrink-0">SD</Badge>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card border-l-4 border-l-orange-500">
          <CardContent className="p-3">
            <div className="flex items-start justify-between">
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">HD en stock</p>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <p className="text-xl font-bold">{hdInStock.length.toLocaleString()}</p>
                  <span className="text-xs text-muted-foreground">{hdPct}%</span>
                </div>
              </div>
              <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600 shrink-0">HD</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Activité des 30 derniers jours</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={activityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={2} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="added" name="Ajoutés" fill="hsl(215, 90%, 42%)" radius={[3, 3, 0, 0]} />
              <Line dataKey="given" name="Donnés" stroke="hsl(142, 72%, 40%)" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Middle row: Boxes to split + Top Wilayas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Boxes to split */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                Boxes à éclater
              </CardTitle>
              <Badge variant={boxesOverThreshold.length > 0 ? 'destructive' : 'secondary'}>
                {boxesOverThreshold.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {boxesOverThreshold.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">Aucune box ne dépasse son quota ✓</p>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto">
                {boxesOverThreshold.map(b => (
                  <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div>
                      <p className="font-medium text-sm">{b.name}</p>
                      <p className="text-xs text-muted-foreground">Quota: {b.quota}</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">
                      {b.parcel_count} colis
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Wilayas */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top Wilayas {excludeEch && '(hors ech-)'}</CardTitle>
          </CardHeader>
          <CardContent>
            {topWilayas.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topWilayas} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                    formatter={(value: number, _: string, props: any) => [`${value} (${props.payload.pct}%)`, 'Colis']}
                  />
                  <Bar dataKey="count" fill="hsl(38, 95%, 55%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">Pas de données</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: Boutiques + Status + Quick stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Boutiques */}
        <Card className="glass-card lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Boutiques actives</CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={boutiqueSearch}
                onChange={e => setBoutiqueSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {topBoutiques.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">Aucune boutique</p>
              ) : (
                topBoutiques.map((b, i) => (
                  <div key={b.name} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs text-muted-foreground w-5 text-right shrink-0">{i + 1}.</span>
                      <span className="text-sm truncate">{b.name}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{b.count}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Status distribution */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Distribution des statuts</CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8 text-sm">Pas de données</p>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Stats rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <QuickStat icon={<Clock className="w-4 h-4 text-blue-500" />} label="Heure de pointe" value={peakHour} />
              <QuickStat icon={<TrendingUp className="w-4 h-4 text-green-500" />} label="Délai moyen livraison" value={avgDeliveryDays ? `${avgDeliveryDays} jours` : 'N/A'} />
              <QuickStat icon={<Store className="w-4 h-4 text-amber-500" />} label="Top boutique" value={topBoutiques[0]?.name || 'N/A'} subValue={topBoutiques[0] ? `${topBoutiques[0].count} colis` : undefined} />
              <QuickStat icon={<BoxIcon className="w-4 h-4 text-indigo-500" />} label="Taux d'utilisation boxes" value={boxes.length > 0 ? `${Math.round((boxParcelCounts.filter(b => b.parcel_count > 0).length / boxes.length) * 100)}%` : 'N/A'} />
              <QuickStat icon={<AlertTriangle className="w-4 h-4 text-destructive" />} label="Colis bloqués (+7j)" value={String(stuckParcels)} highlight={stuckParcels > 0} />
              <QuickStat icon={<Package className="w-4 h-4 text-muted-foreground" />} label="Hier: ajoutés / donnés" value={`${addedYesterday.length} / ${givenYesterday.length}`} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const QuickStat = ({ icon, label, value, subValue, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  highlight?: boolean;
}) => (
  <div className="flex items-center gap-3 py-1.5">
    {icon}
    <div className="flex-1 min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold truncate ${highlight ? 'text-destructive' : ''}`}>
        {value}
        {subValue && <span className="text-xs font-normal text-muted-foreground ml-1">({subValue})</span>}
      </p>
    </div>
  </div>
);

export default Statistics;
