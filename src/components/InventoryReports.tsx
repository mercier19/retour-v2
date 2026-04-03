import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Eye, ClipboardCheck } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface InventorySession {
  id: string;
  warehouse_id: string;
  started_at: string;
  completed_at: string | null;
  completed_by: string | null;
  notes: string | null;
  scheduled_inventory_id: string | null;
}

interface InventoryCheck {
  id: string;
  box_id: string;
  expected_count: number;
  actual_count: number;
  discrepancies: { missing?: string[]; extra?: string[] } | null;
  checked_at: string;
  checked_by: string | null;
}

interface BoxInfo {
  id: string;
  name: string;
}

const InventoryReports: React.FC = () => {
  const { warehouseIds } = useWarehouseFilter();
  const { warehouses } = useAuth();
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailSession, setDetailSession] = useState<InventorySession | null>(null);
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [boxNames, setBoxNames] = useState<Record<string, string>>({});
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [loadingDetails, setLoadingDetails] = useState(false);

  const warehouseNameMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]));

  useEffect(() => {
    if (warehouseIds.length > 0) loadSessions();
  }, [warehouseIds.length]);

  const loadSessions = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('inventory_sessions')
      .select('*')
      .in('warehouse_id', warehouseIds)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    const sessionData = (data as unknown as InventorySession[]) || [];
    setSessions(sessionData);

    // Load profile names for completed_by
    const userIds = [...new Set(sessionData.map(s => s.completed_by).filter(Boolean))] as string[];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      if (profiles) {
        const map: Record<string, string> = {};
        profiles.forEach((p: any) => { map[p.id] = p.full_name || p.id.substring(0, 8); });
        setProfileNames(map);
      }
    }
    setLoading(false);
  };

  const openDetails = async (session: InventorySession) => {
    setDetailSession(session);
    setLoadingDetails(true);

    const { data } = await supabase
      .from('inventory_checks')
      .select('*')
      .eq('inventory_session_id', session.id)
      .order('checked_at', { ascending: true });

    const checkData = (data as unknown as InventoryCheck[]) || [];
    setChecks(checkData);

    // Load box names
    const boxIds = [...new Set(checkData.map(c => c.box_id))];
    if (boxIds.length > 0) {
      const { data: boxData } = await supabase
        .from('boxes')
        .select('id, name')
        .in('id', boxIds);
      if (boxData) {
        const map: Record<string, string> = {};
        (boxData as BoxInfo[]).forEach(b => { map[b.id] = b.name; });
        setBoxNames(map);
      }
    }
    setLoadingDetails(false);
  };

  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx');

      const rows = sessions.map(s => ({
        'Dépôt': warehouseNameMap[s.warehouse_id] || '?',
        'Date': s.completed_at ? format(new Date(s.completed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '',
        'Opérateur': s.completed_by ? (profileNames[s.completed_by] || '?') : '?',
        'Notes': s.notes || '',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventaires');
      XLSX.writeFile(wb, `inventaires-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast.success('Export téléchargé');
    } catch {
      toast.error("Erreur lors de l'export");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5" /> Rapports d'inventaire
        </h3>
        <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1 text-xs">
          <Download className="w-3.5 h-3.5" /> Excel
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">Aucun inventaire terminé</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dépôt</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Opérateur</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map(session => (
              <TableRow key={session.id}>
                <TableCell className="font-medium">{warehouseNameMap[session.warehouse_id] || '?'}</TableCell>
                <TableCell>
                  {session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}
                </TableCell>
                <TableCell>{session.completed_by ? (profileNames[session.completed_by] || '?') : '—'}</TableCell>
                <TableCell className="max-w-[200px] truncate">{session.notes || '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="gap-1" onClick={() => openDetails(session)}>
                    <Eye className="w-3.5 h-3.5" /> Détails
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Details modal */}
      <Dialog open={!!detailSession} onOpenChange={(open) => { if (!open) setDetailSession(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Détails de l'inventaire</DialogTitle>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {checks.map(check => {
                const disc = check.discrepancies || { missing: [], extra: [] };
                const missing = disc.missing || [];
                const extra = disc.extra || [];
                const isOk = missing.length === 0 && extra.length === 0;

                return (
                  <Card key={check.id}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        <span>{boxNames[check.box_id] || 'Box'}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">
                            {check.actual_count} / {check.expected_count}
                          </span>
                          {isOk ? (
                            <Badge className="text-xs">OK</Badge>
                          ) : (
                            <Badge variant="destructive" className="text-xs">Écarts</Badge>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    {!isOk && (
                      <CardContent className="pt-0 space-y-2">
                        {missing.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-destructive mb-1">Manquants ({missing.length})</p>
                            <div className="flex flex-wrap gap-1">
                              {missing.map((t, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {extra.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-600 mb-1">Excédentaires ({extra.length})</p>
                            <div className="flex flex-wrap gap-1">
                              {extra.map((t, i) => (
                                <Badge key={i} variant="outline" className="text-xs font-mono">{t}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryReports;
