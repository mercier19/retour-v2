import React, { useEffect, useState, useMemo } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, ComposedChart, Legend,
} from 'recharts';
import {
  Package, TrendingUp, TrendingDown, Store, AlertTriangle,
  Trophy, Target, ArrowUpRight, ArrowDownRight, Building2,
  Calendar, Search, Download, Clock, Users, FileText,
} from 'lucide-react';
import { format, subDays, startOfDay, startOfWeek, startOfMonth, parseISO, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getWilayaName } from '@/lib/wilayas';
import { toast } from 'sonner';
import { generateAdvancedReport } from '@/utils/exportToPPTX';
import InventoryReports from '@/components/InventoryReports';

const COLORS = [
  'hsl(0, 78%, 47%)', 'hsl(38, 95%, 55%)', 'hsl(142, 72%, 40%)',
  'hsl(215, 90%, 42%)', 'hsl(280, 60%, 50%)', 'hsl(190, 70%, 45%)',
  'hsl(340, 80%, 50%)', 'hsl(60, 70%, 45%)', 'hsl(160, 60%, 40%)',
  'hsl(30, 80%, 50%)',
];

interface WarehouseStat {
  warehouse_id: string;
  warehouse_name: string;
  warehouse_type: string;
  received: number;
  given: number;
  missing: number;
  in_transit: number;
  misrouted: number;
  active_in_stock: number;
}

interface ParcelRow {
  id: string;
  tracking: string;
  boutique: string | null;
  wilaya: string | null;
  status: string | null;
  is_missing: boolean | null;
  created_at: string;
  given_at: string | null;
  warehouse_id: string;
  updated_at: string;
  delivery_type: string | null;
  transfer_status: string | null;
}

interface UserRankingItem {
  userId: string;
  userName: string;
  total: number;
  details: Record<string, number>;
}

type DateRange = 'today' | 'week' | 'month' | '30days' | 'all';
type SortKey = 'received' | 'given' | 'give_rate' | 'missing' | 'missing_rate' | 'in_transit' | 'misrouted';

const ACTION_LABELS: Record<string, string> = {
  add_parcel: 'Ajouts',
  give_to_boutique: 'Remises',
  transfer_initiated: 'Transferts',
  transfer_received: 'Réceptions',
  clear_box: 'Vidage box',
  clear_all_stock: 'Vidage stock',
  mark_missing: 'Manquants',
};

const AdvancedStatistics: React.FC = () => {
  const { warehouseIds, hasRole } = useWarehouseFilter();
  const { warehouses } = useAuth();
  const [warehouseStats, setWarehouseStats] = useState<WarehouseStat[]>([]);
  const [parcels, setParcels] = useState<ParcelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [sortKey, setSortKey] = useState<SortKey>('received');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedWarehouses, setSelectedWarehouses] = useState<string[]>([]);
  const [boutiqueSearch, setBoutiqueSearch] = useState('');
  const [userRanking, setUserRanking] = useState<UserRankingItem[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [exportingPPTX, setExportingPPTX] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);

  const isAllowed = hasRole('regional', 'super_admin');

  const dateFilter = useMemo(() => {
    const now = startOfDay(new Date());
    switch (dateRange) {
      case 'today': return now;
      case 'week': return startOfWeek(now, { weekStartsOn: 1 });
      case 'month': return startOfMonth(now);
      case '30days': return subDays(now, 30);
      case 'all': return null;
    }
  }, [dateRange]);

  const activeWarehouseIds = selectedWarehouses.length > 0 ? selectedWarehouses : warehouseIds;

  useEffect(() => {
    if (warehouseIds.length > 0 && isAllowed) {
      loadData();
      loadUserActivity();
    }
  }, [warehouseIds.length, dateRange, isAllowed]);

  const fetchAllParcels = async (warehouseIds: string[], startDate: string | null) => {
    const PAGE_SIZE = 1000;
    let allData: ParcelRow[] = [];
    let from = 0;
    let hasMore = true;

    while (hasMore) {
      let q = supabase.from('parcels')
        .select('id, tracking, boutique, wilaya, status, is_missing, created_at, given_at, warehouse_id, updated_at, delivery_type, transfer_status')
        .in('warehouse_id', warehouseIds);
      if (startDate) q = q.gte('created_at', startDate);
      const { data } = await q.range(from, from + PAGE_SIZE - 1);
      if (data && data.length > 0) {
        allData = allData.concat(data as ParcelRow[]);
        from += PAGE_SIZE;
        hasMore = data.length === PAGE_SIZE;
      } else {
        hasMore = false;
      }
    }
    return allData;
  };

  const loadData = async () => {
    if (warehouseIds.length === 0) return;
    setLoading(true);

    const startDate = dateFilter ? dateFilter.toISOString() : null;

    const [statsRes, allParcels] = await Promise.all([
      supabase.rpc('warehouse_stats', {
        p_warehouse_ids: warehouseIds,
        p_start_date: startDate,
        p_end_date: null,
      }),
      fetchAllParcels(warehouseIds, startDate),
    ]);

    if (statsRes.data) {
      setWarehouseStats(statsRes.data.map((r: any) => ({
        ...r,
        received: Number(r.received),
        given: Number(r.given),
        missing: Number(r.missing),
        in_transit: Number(r.in_transit),
        misrouted: Number(r.misrouted),
        active_in_stock: Number(r.active_in_stock),
      })));
    }
    setParcels(allParcels);
    setLoading(false);
  };

  const loadUserActivity = async () => {
    if (warehouseIds.length === 0) return;
    setLoadingUsers(true);

    const startDate = dateFilter ? dateFilter.toISOString() : null;

    let query = supabase
      .from('user_actions' as any)
      .select('user_id, action_type')
      .in('warehouse_id', warehouseIds);

    if (startDate) query = query.gte('created_at', startDate);

    const { data: actions } = await query.limit(5000);

    if (!actions || actions.length === 0) {
      setUserRanking([]);
      setLoadingUsers(false);
      return;
    }

    // Aggregate by user
    const userMap = new Map<string, { total: number; details: Record<string, number> }>();
    (actions as any[]).forEach((act: any) => {
      if (!act.user_id) return;
      if (!userMap.has(act.user_id)) userMap.set(act.user_id, { total: 0, details: {} });
      const u = userMap.get(act.user_id)!;
      u.total++;
      u.details[act.action_type] = (u.details[act.action_type] || 0) + 1;
    });

    // Get user names
    const userIds = Array.from(userMap.keys());
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', userIds);

    const nameMap: Record<string, string> = {};
    profiles?.forEach((p: any) => { nameMap[p.id] = p.full_name || p.id; });

    const ranking: UserRankingItem[] = Array.from(userMap.entries())
      .map(([userId, data]) => ({
        userId,
        userName: nameMap[userId] || userId.substring(0, 8),
        ...data,
      }))
      .sort((a, b) => b.total - a.total);

    setUserRanking(ranking);
    setLoadingUsers(false);
  };

  // Filtered stats based on selected warehouses
  const filteredStats = useMemo(() =>
    selectedWarehouses.length > 0
      ? warehouseStats.filter(s => selectedWarehouses.includes(s.warehouse_id))
      : warehouseStats,
    [warehouseStats, selectedWarehouses]
  );

  const filteredParcels = useMemo(() =>
    selectedWarehouses.length > 0
      ? parcels.filter(p => selectedWarehouses.includes(p.warehouse_id))
      : parcels,
    [parcels, selectedWarehouses]
  );

  // Aggregated totals
  const totals = useMemo(() => {
    return filteredStats.reduce((acc, s) => ({
      received: acc.received + s.received,
      given: acc.given + s.given,
      missing: acc.missing + s.missing,
      in_transit: acc.in_transit + s.in_transit,
      misrouted: acc.misrouted + s.misrouted,
      active_in_stock: acc.active_in_stock + s.active_in_stock,
    }), { received: 0, given: 0, missing: 0, in_transit: 0, misrouted: 0, active_in_stock: 0 });
  }, [filteredStats]);

  const uniqueBoutiques = useMemo(() => {
    const set = new Set<string>();
    filteredParcels.forEach(p => { if (p.boutique && p.status !== 'given') set.add(p.boutique); });
    return set;
  }, [filteredParcels]);

  // Sorted warehouse table
  const sortedStats = useMemo(() => {
    const arr = [...filteredStats];
    arr.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case 'received': av = a.received; bv = b.received; break;
        case 'given': av = a.given; bv = b.given; break;
        case 'give_rate': av = a.received ? a.given / a.received : 0; bv = b.received ? b.given / b.received : 0; break;
        case 'missing': av = a.missing; bv = b.missing; break;
        case 'missing_rate': av = a.received ? a.missing / a.received : 0; bv = b.received ? b.missing / b.received : 0; break;
        case 'in_transit': av = a.in_transit; bv = b.in_transit; break;
        case 'misrouted': av = a.misrouted; bv = b.misrouted; break;
        default: av = a.received; bv = b.received;
      }
      return sortAsc ? av - bv : bv - av;
    });
    return arr;
  }, [filteredStats, sortKey, sortAsc]);

  // Rankings
  const rankings = useMemo(() => {
    if (filteredStats.length === 0) return null;
    const mostActive = [...filteredStats].sort((a, b) => b.received - a.received)[0];
    const mostGiven = [...filteredStats].sort((a, b) => b.given - a.given)[0];
    const lowestMissingRate = [...filteredStats]
      .filter(s => s.received > 0)
      .sort((a, b) => (a.missing / a.received) - (b.missing / b.received))[0];
    const mostTransfers = [...filteredStats].sort((a, b) => b.in_transit - a.in_transit)[0];
    const avgReceived = totals.received / filteredStats.length;
    return { mostActive, mostGiven, lowestMissingRate, mostTransfers, avgReceived };
  }, [filteredStats, totals]);

  // Top wilayas
  const topWilayas = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredParcels.forEach(p => {
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
  }, [filteredParcels]);

  // Top boutiques
  const topBoutiques = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredParcels.filter(p => p.status !== 'given').forEach(p => {
      if (p.boutique) counts[p.boutique] = (counts[p.boutique] || 0) + 1;
    });
    let entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    if (boutiqueSearch) entries = entries.filter(([n]) => n.toLowerCase().includes(boutiqueSearch.toLowerCase()));
    return entries.slice(0, 15).map(([name, count]) => ({ name, count }));
  }, [filteredParcels, boutiqueSearch]);

  // Status distribution
  const statusData = useMemo(() => {
    const statuses: Record<string, number> = {};
    filteredParcels.forEach(p => {
      let s: string;
      if (p.transfer_status === 'misrouted') s = 'Mal dirigé';
      else if (p.transfer_status === 'in_transit') s = 'En transfert';
      else if (p.is_missing) s = 'Manquant';
      else if (p.status === 'given') s = 'Donné';
      else s = 'En stock';
      statuses[s] = (statuses[s] || 0) + 1;
    });
    return Object.entries(statuses).map(([name, value]) => ({ name, value }));
  }, [filteredParcels]);

  // Activity chart - 30 days
  const activityData = useMemo(() => {
    const today = startOfDay(new Date());
    const days: Record<string, { date: string; added: number; given: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(today, i), 'yyyy-MM-dd');
      days[d] = { date: format(subDays(today, i), 'dd/MM', { locale: fr }), added: 0, given: 0 };
    }
    filteredParcels.forEach(p => {
      const cDay = p.created_at?.substring(0, 10);
      if (cDay && days[cDay]) days[cDay].added++;
      if (p.given_at) {
        const gDay = p.given_at.substring(0, 10);
        if (gDay && days[gDay]) days[gDay].given++;
      }
    });
    return Object.values(days);
  }, [filteredParcels]);

  // Warehouse comparison chart
  const warehouseComparisonData = useMemo(() =>
    filteredStats.map(s => ({
      name: s.warehouse_name.length > 12 ? s.warehouse_name.substring(0, 12) + '…' : s.warehouse_name,
      fullName: s.warehouse_name,
      received: s.received,
      given: s.given,
      missing: s.missing,
    })),
    [filteredStats]
  );

  // Export CSV
  const exportCSV = () => {
    const headers = ['Dépôt', 'Type', 'Reçus', 'Donnés', 'Taux don %', 'Manquants', 'Taux manquants %', 'En transfert', 'Mal dirigés'];
    const rows = sortedStats.map(s => [
      s.warehouse_name,
      s.warehouse_type,
      s.received,
      s.given,
      s.received ? ((s.given / s.received) * 100).toFixed(1) : '0',
      s.missing,
      s.received ? ((s.missing / s.received) * 100).toFixed(1) : '0',
      s.in_transit,
      s.misrouted,
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stats-depots-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PPTX
  const exportPPTX = async () => {
    setExportingPPTX(true);
    try {
      const dateLabels: Record<DateRange, string> = {
        today: "Aujourd'hui",
        week: 'Cette semaine',
        month: 'Ce mois',
        '30days': '30 derniers jours',
        all: 'Tout',
      };
      const fileName = await generateAdvancedReport(
        totals,
        filteredStats,
        userRanking,
        dateLabels[dateRange],
      );
      toast.success(`Rapport "${fileName}" téléchargé`);
    } catch (err) {
      console.error('PPTX export error:', err);
      toast.error("Erreur lors de l'export PPTX");
    }
    setExportingPPTX(false);
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <th
      className="px-3 py-2 text-left text-xs font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
      onClick={() => handleSort(sortField)}
    >
      {label} {sortKey === sortField ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  );

  if (!isAllowed) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto" />
          <p className="text-muted-foreground">Accès réservé aux responsables régionaux et super admins.</p>
        </div>
      </div>
    );
  }

  if (loading && warehouseStats.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const giveRate = totals.received > 0 ? ((totals.given / totals.received) * 100).toFixed(1) : '0';
  const missingRate = totals.received > 0 ? ((totals.missing / totals.received) * 100).toFixed(1) : '0';

  const kpis = [
    { label: 'Colis reçus', value: totals.received, icon: Package, color: 'text-primary' },
    { label: 'En stock', value: totals.active_in_stock, icon: Package, color: 'text-blue-600' },
    { label: 'Donnés', value: totals.given, icon: TrendingDown, color: 'text-green-600' },
    { label: 'Taux de don', value: `${giveRate}%`, icon: TrendingUp, color: 'text-emerald-600' },
    { label: 'Manquants', value: totals.missing, icon: AlertTriangle, color: totals.missing > 0 ? 'text-destructive' : 'text-muted-foreground' },
    { label: 'En transfert', value: totals.in_transit, icon: TrendingUp, color: 'text-indigo-600' },
    { label: 'Mal dirigés', value: totals.misrouted, icon: AlertTriangle, color: totals.misrouted > 0 ? 'text-destructive' : 'text-muted-foreground' },
    { label: 'Boutiques', value: uniqueBoutiques.size, icon: Store, color: 'text-amber-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Header + Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Statistiques avancées</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
            <SelectTrigger className="w-[140px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="week">Cette semaine</SelectItem>
              <SelectItem value="month">Ce mois</SelectItem>
              <SelectItem value="30days">30 jours</SelectItem>
              <SelectItem value="all">Tout</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedWarehouses.length === 0 ? '__all__' : selectedWarehouses[0]}
            onValueChange={(v) => setSelectedWarehouses(v === '__all__' ? [] : [v])}
          >
            <SelectTrigger className="w-[160px] h-8 text-xs">
              <SelectValue placeholder="Tous les dépôts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Tous les dépôts</SelectItem>
              {warehouses.map(w => (
                <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV} className="h-8 text-xs gap-1">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportPPTX} disabled={exportingPPTX} className="h-8 text-xs gap-1">
            <FileText className="w-3.5 h-3.5" /> {exportingPPTX ? 'Export...' : 'PPTX'}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="glass-card">
            <CardContent className="p-3">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
                  <p className="text-xl font-bold mt-1">{typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}</p>
                </div>
                <kpi.icon className={`w-4 h-4 ${kpi.color} opacity-70 shrink-0`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="performance">Performance dépôts</TabsTrigger>
          <TabsTrigger value="users">Activité utilisateurs</TabsTrigger>
          <TabsTrigger value="overview">Vue d'ensemble</TabsTrigger>
          <TabsTrigger value="inventories">Inventaires</TabsTrigger>
        </TabsList>

        {/* === PERFORMANCE TAB === */}
        <TabsContent value="performance" className="space-y-6">
          {/* Rankings Cards */}
          {rankings && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <RankingCard
                icon={<Trophy className="w-5 h-5 text-amber-500" />}
                title="Le plus actif"
                name={rankings.mostActive?.warehouse_name || 'N/A'}
                value={`${rankings.mostActive?.received.toLocaleString() || 0} colis`}
                comparison={rankings.avgReceived > 0 ? `Moy: ${Math.round(rankings.avgReceived)}` : undefined}
              />
              <RankingCard
                icon={<TrendingDown className="w-5 h-5 text-green-500" />}
                title="Le plus généreux"
                name={rankings.mostGiven?.warehouse_name || 'N/A'}
                value={`${rankings.mostGiven?.given.toLocaleString() || 0} donnés`}
              />
              <RankingCard
                icon={<Target className="w-5 h-5 text-blue-500" />}
                title="Le plus précis"
                name={rankings.lowestMissingRate?.warehouse_name || 'N/A'}
                value={rankings.lowestMissingRate && rankings.lowestMissingRate.received > 0
                  ? `${((rankings.lowestMissingRate.missing / rankings.lowestMissingRate.received) * 100).toFixed(1)}% manquants`
                  : 'N/A'}
              />
              <RankingCard
                icon={<ArrowUpRight className="w-5 h-5 text-indigo-500" />}
                title="Plus de transferts"
                name={rankings.mostTransfers?.warehouse_name || 'N/A'}
                value={`${rankings.mostTransfers?.in_transit.toLocaleString() || 0} en transit`}
              />
            </div>
          )}

          {/* Warehouse comparison chart */}
          {warehouseComparisonData.length > 1 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Comparaison des dépôts</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={warehouseComparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="received" name="Reçus" fill="hsl(215, 90%, 42%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="given" name="Donnés" fill="hsl(142, 72%, 40%)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="missing" name="Manquants" fill="hsl(0, 78%, 47%)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Warehouse Performance Table */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Performance des dépôts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Dépôt</th>
                      <SortHeader label="Reçus" sortField="received" />
                      <SortHeader label="Donnés" sortField="given" />
                      <SortHeader label="Taux don" sortField="give_rate" />
                      <SortHeader label="Manquants" sortField="missing" />
                      <SortHeader label="Taux manq." sortField="missing_rate" />
                      <SortHeader label="En transit" sortField="in_transit" />
                      <SortHeader label="Mal dirigés" sortField="misrouted" />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStats.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-8 text-muted-foreground">Aucune donnée</td></tr>
                    ) : (
                      sortedStats.map((s) => {
                        const gr = s.received > 0 ? ((s.given / s.received) * 100) : 0;
                        const mr = s.received > 0 ? ((s.missing / s.received) * 100) : 0;
                        const isBestReceived = filteredStats.length > 1 && s.received === Math.max(...filteredStats.map(x => x.received));
                        const isBestGiveRate = filteredStats.length > 1 && s.received > 0 && gr === Math.max(...filteredStats.filter(x => x.received > 0).map(x => (x.given / x.received) * 100));
                        const isWorstMissing = filteredStats.length > 1 && s.received > 0 && mr === Math.max(...filteredStats.filter(x => x.received > 0).map(x => (x.missing / x.received) * 100)) && mr > 0;

                        return (
                          <tr
                            key={s.warehouse_id}
                            className={`border-b border-border/50 transition-colors hover:bg-secondary/30 ${
                              isWorstMissing ? 'bg-destructive/5' : isBestReceived ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium">{s.warehouse_name}</span>
                                <Badge variant="outline" className="text-[9px] px-1 py-0">{s.warehouse_type}</Badge>
                                {isBestReceived && <span title="Le plus actif">🏆</span>}
                                {isBestGiveRate && <span title="Meilleur taux de don">📈</span>}
                                {isWorstMissing && <span title="Taux manquants le plus élevé">⚠️</span>}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 font-medium">{s.received.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-green-600">{s.given.toLocaleString()}</td>
                            <td className="px-3 py-2.5">
                              <Badge variant={gr >= 50 ? 'default' : 'secondary'} className="text-[10px]">
                                {gr.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className={`px-3 py-2.5 ${s.missing > 0 ? 'text-destructive font-medium' : ''}`}>
                              {s.missing.toLocaleString()}
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge variant={mr > 5 ? 'destructive' : 'secondary'} className="text-[10px]">
                                {mr.toFixed(1)}%
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5">{s.in_transit.toLocaleString()}</td>
                            <td className={`px-3 py-2.5 ${s.misrouted > 0 ? 'text-destructive' : ''}`}>
                              {s.misrouted.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* === USERS TAB === */}
        <TabsContent value="users" className="space-y-6">
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Classement des utilisateurs par activité
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                </div>
              ) : userRanking.length === 0 ? (
                <p className="text-muted-foreground text-center py-8 text-sm">
                  Aucune activité enregistrée pour cette période. Les actions seront suivies à partir de maintenant.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr className="border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground w-8">#</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Utilisateur</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Total</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Ajouts</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Remises</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Transferts</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground">Autres</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userRanking.slice(0, 20).map((u, i) => {
                        const adds = u.details['add_parcel'] || 0;
                        const gives = u.details['give_to_boutique'] || 0;
                        const transfers = (u.details['transfer_initiated'] || 0) + (u.details['transfer_received'] || 0);
                        const others = u.total - adds - gives - transfers;
                        return (
                          <tr key={u.userId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                            <td className="px-3 py-2.5 text-muted-foreground font-medium">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                            </td>
                            <td className="px-3 py-2.5 font-medium">{u.userName}</td>
                            <td className="px-3 py-2.5 text-center font-bold">{u.total.toLocaleString()}</td>
                            <td className="px-3 py-2.5 text-center">{adds > 0 ? adds.toLocaleString() : '-'}</td>
                            <td className="px-3 py-2.5 text-center">{gives > 0 ? gives.toLocaleString() : '-'}</td>
                            <td className="px-3 py-2.5 text-center">{transfers > 0 ? transfers.toLocaleString() : '-'}</td>
                            <td className="px-3 py-2.5 text-center text-muted-foreground">{others > 0 ? others.toLocaleString() : '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* User activity breakdown chart */}
          {userRanking.length > 0 && (
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Activité par utilisateur</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={Math.max(200, userRanking.slice(0, 10).length * 40)}>
                  <BarChart data={userRanking.slice(0, 10).map(u => ({
                    name: u.userName.length > 15 ? u.userName.substring(0, 15) + '…' : u.userName,
                    Ajouts: u.details['add_parcel'] || 0,
                    Remises: u.details['give_to_boutique'] || 0,
                    Transferts: (u.details['transfer_initiated'] || 0) + (u.details['transfer_received'] || 0),
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Ajouts" stackId="a" fill="hsl(215, 90%, 42%)" />
                    <Bar dataKey="Remises" stackId="a" fill="hsl(142, 72%, 40%)" />
                    <Bar dataKey="Transferts" stackId="a" fill="hsl(38, 95%, 55%)" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === OVERVIEW TAB === */}
        <TabsContent value="overview" className="space-y-6">
          {/* Activity chart */}
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
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="added" name="Ajoutés" fill="hsl(215, 90%, 42%)" radius={[3, 3, 0, 0]} />
                  <Line dataKey="given" name="Donnés" stroke="hsl(142, 72%, 40%)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Wilayas */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Top Wilayas</CardTitle>
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

            {/* Status distribution */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Distribution des statuts</CardTitle>
              </CardHeader>
              <CardContent>
                {statusData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
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
          </div>

          {/* Boutiques */}
          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top Boutiques actives</CardTitle>
              <div className="relative mt-2 max-w-xs">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-[300px] overflow-y-auto">
                {topBoutiques.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-4 col-span-full">Aucune boutique</p>
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
        </TabsContent>

        {/* === INVENTORIES TAB === */}
        <TabsContent value="inventories">
          <InventoryReports />
        </TabsContent>
      </Tabs>
    </div>
  );
};

const RankingCard = ({ icon, title, name, value, comparison }: {
  icon: React.ReactNode;
  title: string;
  name: string;
  value: string;
  comparison?: string;
}) => (
  <Card className="glass-card">
    <CardContent className="p-4">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-sm font-bold truncate mt-0.5">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{value}</p>
          {comparison && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{comparison}</p>}
        </div>
      </div>
    </CardContent>
  </Card>
);

export default AdvancedStatistics;
