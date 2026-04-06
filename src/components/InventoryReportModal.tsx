import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Loader2 } from 'lucide-react';
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

interface Props {
  session: InventorySession;
  warehouseName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const InventoryReportModal: React.FC<Props> = ({ session, warehouseName, open, onOpenChange }) => {
  const [checks, setChecks] = useState<InventoryCheck[]>([]);
  const [boxNames, setBoxNames] = useState<Record<string, string>>({});
  const [completedByName, setCompletedByName] = useState('');
  const [createdByName, setCreatedByName] = useState('');
  const [scheduledCreatedAt, setScheduledCreatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) loadData();
  }, [open, session.id]);

  const loadData = async () => {
    setLoading(true);

    // Load checks
    const { data: checkData } = await supabase
      .from('inventory_checks')
      .select('*')
      .eq('inventory_session_id', session.id)
      .order('checked_at', { ascending: true });

    const parsedChecks = (checkData as unknown as InventoryCheck[]) || [];
    setChecks(parsedChecks);

    // Load box names
    const boxIds = [...new Set(parsedChecks.map(c => c.box_id))];
    if (boxIds.length > 0) {
      const { data: boxData } = await supabase.from('boxes').select('id, name').in('id', boxIds);
      if (boxData) {
        const map: Record<string, string> = {};
        boxData.forEach((b: any) => { map[b.id] = b.name; });
        setBoxNames(map);
      }
    }

    // Load completed_by profile
    if (session.completed_by) {
      const { data: p } = await supabase.from('profiles').select('full_name').eq('id', session.completed_by).single();
      if (p) setCompletedByName((p as any).full_name || session.completed_by.substring(0, 8));
    }

    // Load scheduled inventory info (created_by, created_at)
    if (session.scheduled_inventory_id) {
      const { data: si } = await supabase
        .from('scheduled_inventories')
        .select('created_by, created_at')
        .eq('id', session.scheduled_inventory_id)
        .single();
      if (si) {
        setScheduledCreatedAt((si as any).created_at);
        if ((si as any).created_by) {
          const { data: cp } = await supabase.from('profiles').select('full_name').eq('id', (si as any).created_by).single();
          if (cp) setCreatedByName((cp as any).full_name || (si as any).created_by.substring(0, 8));
        }
      }
    }

    setLoading(false);
  };

  const getDuration = () => {
    if (!session.completed_at) return '—';
    const start = new Date(session.started_at).getTime();
    const end = new Date(session.completed_at).getTime();
    const mins = Math.round((end - start) / 60000);
    if (mins < 60) return `${mins} min`;
    return `${Math.floor(mins / 60)}h ${mins % 60}min`;
  };

  const totalScanned = checks.reduce((s, c) => s + (c.actual_count || 0), 0);
  const totalExpected = checks.reduce((s, c) => s + c.expected_count, 0);
  const totalMissing = checks.reduce((s, c) => s + (c.discrepancies?.missing?.length || 0), 0);
  const totalExtra = checks.reduce((s, c) => s + (c.discrepancies?.extra?.length || 0), 0);

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');

      const doc = new jsPDF();
      let y = 20;

      doc.setFontSize(18);
      doc.text("Rapport d'inventaire", 14, y);
      y += 10;

      doc.setFontSize(10);
      doc.text(`Dépôt : ${warehouseName}`, 14, y); y += 6;
      doc.text(`Date : ${session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}`, 14, y); y += 6;
      doc.text(`Durée : ${getDuration()}`, 14, y); y += 6;
      doc.text(`Réalisé par : ${completedByName || '—'}`, 14, y); y += 6;
      if (createdByName) {
        doc.text(`Créé par : ${createdByName}`, 14, y); y += 6;
      }
      if (scheduledCreatedAt) {
        doc.text(`Date de création : ${format(new Date(scheduledCreatedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}`, 14, y); y += 6;
      }
      if (session.notes) {
        doc.text(`Notes : ${session.notes}`, 14, y); y += 6;
      }

      y += 4;
      doc.setFontSize(12);
      doc.text('Résumé', 14, y); y += 6;
      doc.setFontSize(10);
      doc.text(`Boîtes vérifiées : ${checks.length}`, 14, y); y += 5;
      doc.text(`Colis scannés : ${totalScanned} / ${totalExpected}`, 14, y); y += 5;
      doc.text(`Manquants : ${totalMissing}`, 14, y); y += 5;
      doc.text(`Excédentaires : ${totalExtra}`, 14, y); y += 10;

      // Discrepancy details
      const checksWithIssues = checks.filter(c => {
        const d = c.discrepancies || {};
        return (d.missing?.length || 0) > 0 || (d.extra?.length || 0) > 0;
      });

      if (checksWithIssues.length > 0) {
        doc.setFontSize(12);
        doc.text('Détail des écarts', 14, y); y += 8;

        for (const check of checksWithIssues) {
          const boxName = boxNames[check.box_id] || 'Box';
          const missing = check.discrepancies?.missing || [];
          const extra = check.discrepancies?.extra || [];

          if (y > 260) { doc.addPage(); y = 20; }

          doc.setFontSize(11);
          doc.text(`${boxName} (${check.actual_count}/${check.expected_count})`, 14, y); y += 6;

          if (missing.length > 0) {
            autoTable(doc, {
              startY: y,
              head: [['Manquants']],
              body: missing.map(t => [t]),
              theme: 'grid',
              headStyles: { fillColor: [220, 53, 69] },
              margin: { left: 14 },
              tableWidth: 80,
            });
            y = (doc as any).lastAutoTable.finalY + 4;
          }

          if (extra.length > 0) {
            autoTable(doc, {
              startY: y,
              head: [['Excédentaires']],
              body: extra.map(t => [t]),
              theme: 'grid',
              headStyles: { fillColor: [255, 193, 7] },
              margin: { left: 14 },
              tableWidth: 80,
            });
            y = (doc as any).lastAutoTable.finalY + 6;
          }
        }
      }

      doc.save(`inventaire-${warehouseName}-${format(new Date(session.completed_at || new Date()), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF téléchargé');
    } catch (err) {
      console.error(err);
      toast.error("Erreur lors de l'export PDF");
    }
    setExporting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Rapport d'inventaire</span>
            <Button size="sm" variant="outline" className="gap-1" onClick={exportPDF} disabled={loading || exporting}>
              {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="text-muted-foreground">Dépôt :</span> {warehouseName}</div>
              <div><span className="text-muted-foreground">Date :</span> {session.completed_at ? format(new Date(session.completed_at), 'dd/MM/yyyy HH:mm', { locale: fr }) : '—'}</div>
              <div><span className="text-muted-foreground">Durée :</span> {getDuration()}</div>
              <div><span className="text-muted-foreground">Réalisé par :</span> {completedByName || '—'}</div>
              {createdByName && <div><span className="text-muted-foreground">Créé par :</span> {createdByName}</div>}
              {scheduledCreatedAt && <div><span className="text-muted-foreground">Date de création :</span> {format(new Date(scheduledCreatedAt), 'dd/MM/yyyy HH:mm', { locale: fr })}</div>}
            </div>
            {session.notes && <p className="text-sm"><span className="text-muted-foreground">Notes :</span> {session.notes}</p>}

            {/* Summary */}
            <div className="grid grid-cols-4 gap-2">
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{checks.length}</p><p className="text-xs text-muted-foreground">Boîtes</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold">{totalScanned}/{totalExpected}</p><p className="text-xs text-muted-foreground">Scannés</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-destructive">{totalMissing}</p><p className="text-xs text-muted-foreground">Manquants</p></CardContent></Card>
              <Card><CardContent className="p-3 text-center"><p className="text-lg font-bold text-amber-600">{totalExtra}</p><p className="text-xs text-muted-foreground">Extra</p></CardContent></Card>
            </div>

            {/* Checks detail */}
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
                        <span className="text-xs text-muted-foreground">{check.actual_count} / {check.expected_count}</span>
                        {isOk ? <Badge className="text-xs">OK</Badge> : <Badge variant="destructive" className="text-xs">Écarts</Badge>}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {!isOk && (
                    <CardContent className="pt-0 space-y-2">
                      {missing.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-destructive mb-1">Manquants ({missing.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {missing.map((t, i) => <Badge key={i} variant="outline" className="text-xs font-mono">{t}</Badge>)}
                          </div>
                        </div>
                      )}
                      {extra.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-amber-600 mb-1">Excédentaires ({extra.length})</p>
                          <div className="flex flex-wrap gap-1">
                            {extra.map((t, i) => <Badge key={i} variant="outline" className="text-xs font-mono">{t}</Badge>)}
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
  );
};

export default InventoryReportModal;
