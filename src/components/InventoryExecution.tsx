import React, { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { useSound } from '@/hooks/useSound';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle2, XCircle, BoxIcon, ScanLine, ClipboardCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface Box {
  id: string;
  name: string;
}

interface ExpectedParcel {
  id: string;
  tracking: string;
  boutique: string | null;
}

interface BoxCheckResult {
  box_id: string;
  box_name: string;
  expected_count: number;
  actual_count: number;
  missing: string[];
  extra: string[];
}

interface ScheduledInventory {
  id: string;
  warehouse_id: string;
  scheduled_date: string;
  status: string;
  is_recurring: boolean;
}

const InventoryExecution: React.FC = () => {
  const { warehouseId, warehouseIds } = useWarehouseFilter();
  const { profile } = useAuth();
  const { playSuccess, playError } = useSound();

  const [pendingInventories, setPendingInventories] = useState<ScheduledInventory[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [expectedParcels, setExpectedParcels] = useState<ExpectedParcel[]>([]);
  const [scannedTrackings, setScannedTrackings] = useState<Set<string>>(new Set());
  const [extraTrackings, setExtraTrackings] = useState<string[]>([]);
  const [scanInput, setScanInput] = useState('');
  const scanRef = useRef<HTMLInputElement>(null);

  const [completedChecks, setCompletedChecks] = useState<BoxCheckResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState(false);
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');

  // All parcels by box preloaded
  const [allParcelsByBox, setAllParcelsByBox] = useState<Record<string, ExpectedParcel[]>>({});

  const activeWarehouseId = warehouseId || (warehouseIds.length > 0 ? warehouseIds[0] : null);

  useEffect(() => {
    if (activeWarehouseId) {
      loadPendingInventories();
      loadBoxesAndParcels();
    }
  }, [activeWarehouseId]);

  const loadPendingInventories = async () => {
    if (!activeWarehouseId) return;
    const { data } = await supabase
      .from('scheduled_inventories')
      .select('*')
      .eq('warehouse_id', activeWarehouseId)
      .in('status', ['pending', 'overdue'])
      .order('scheduled_date', { ascending: true });

    setPendingInventories((data as unknown as ScheduledInventory[]) || []);
    setLoading(false);
  };

  const loadBoxesAndParcels = async () => {
    if (!activeWarehouseId) return;

    const [boxRes, parcelRes] = await Promise.all([
      supabase.from('boxes').select('id, name').eq('warehouse_id', activeWarehouseId),
      supabase.from('parcels')
        .select('id, tracking, boutique, box_id')
        .eq('warehouse_id', activeWarehouseId)
        .eq('status', 'in_stock')
        .is('given_at', null),
    ]);

    const boxList = (boxRes.data || []) as Box[];
    setBoxes(boxList);

    const byBox: Record<string, ExpectedParcel[]> = {};
    boxList.forEach(b => { byBox[b.id] = []; });
    (parcelRes.data || []).forEach((p: any) => {
      if (p.box_id && byBox[p.box_id]) {
        byBox[p.box_id].push({ id: p.id, tracking: p.tracking, boutique: p.boutique });
      }
    });
    setAllParcelsByBox(byBox);
  };

  const startSession = async () => {
    if (!activeWarehouseId) return;

    const { data, error } = await supabase
      .from('inventory_sessions')
      .insert({
        scheduled_inventory_id: selectedScheduleId || null,
        warehouse_id: activeWarehouseId,
        started_at: new Date().toISOString(),
      } as any)
      .select('id')
      .single();

    if (error) {
      toast.error('Erreur: ' + error.message);
      return;
    }
    setSessionId((data as any).id);
    toast.success('Session d\'inventaire démarrée');
  };

  const selectBox = (boxId: string) => {
    // Check if already completed
    if (completedChecks.some(c => c.box_id === boxId)) {
      toast.error('Cette box a déjà été vérifiée');
      return;
    }
    setSelectedBoxId(boxId);
    setExpectedParcels(allParcelsByBox[boxId] || []);
    setScannedTrackings(new Set());
    setExtraTrackings([]);
    setScanInput('');
    setTimeout(() => scanRef.current?.focus(), 100);
  };

  const handleScan = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    const tracking = scanInput.trim();
    if (!tracking) return;

    if (scannedTrackings.has(tracking) || extraTrackings.includes(tracking)) {
      playError();
      toast.error('Déjà scanné');
      return;
    }

    const upperTracking = tracking.toUpperCase();

    if (scannedTrackings.has(upperTracking) || extraTrackings.includes(upperTracking)) {
      playError();
      toast.error('Déjà scanné');
      setScanInput('');
      return;
    }

    const isExpected = expectedParcels.some(p => p.tracking === upperTracking);
    if (isExpected) {
      playSuccess();
      setScannedTrackings(prev => new Set(prev).add(upperTracking));
    } else {
      playError();
      setExtraTrackings(prev => [...prev, tracking]);
      toast.warning('Colis non attendu dans cette box');
    }
    setScanInput('');
  }, [scanInput, scannedTrackings, extraTrackings, expectedParcels, playSuccess, playError]);

  const finishBox = async () => {
    if (!sessionId || !selectedBoxId) return;

    const missing = expectedParcels
      .filter(p => !scannedTrackings.has(p.tracking))
      .map(p => p.tracking);

    const result: BoxCheckResult = {
      box_id: selectedBoxId,
      box_name: boxes.find(b => b.id === selectedBoxId)?.name || '?',
      expected_count: expectedParcels.length,
      actual_count: scannedTrackings.size,
      missing,
      extra: extraTrackings,
    };

    const { error } = await supabase.from('inventory_checks').insert({
      inventory_session_id: sessionId,
      box_id: selectedBoxId,
      expected_count: result.expected_count,
      actual_count: result.actual_count,
      discrepancies: { missing: result.missing, extra: result.extra },
      checked_by: profile?.id,
    } as any);

    if (error) {
      toast.error('Erreur sauvegarde: ' + error.message);
      return;
    }

    setCompletedChecks(prev => [...prev, result]);
    setSelectedBoxId(null);
    setExpectedParcels([]);
    setScannedTrackings(new Set());
    setExtraTrackings([]);
    toast.success(`Box "${result.box_name}" terminée`);
  };

  const closeInventory = async () => {
    if (!sessionId) return;
    setClosing(true);

    const { error } = await supabase
      .from('inventory_sessions')
      .update({
        completed_at: new Date().toISOString(),
        completed_by: profile?.id,
        notes: closeNotes || null,
      } as any)
      .eq('id', sessionId);

    if (error) {
      toast.error('Erreur: ' + error.message);
      setClosing(false);
      return;
    }

    toast.success('Inventaire clôturé');
    setShowCloseDialog(false);
    setSessionId(null);
    setCompletedChecks([]);
    setSelectedScheduleId(null);
    loadPendingInventories();
    setClosing(false);
  };

  const allBoxesChecked = boxes.length > 0 && completedChecks.length >= boxes.length;

  // Before session started
  if (!sessionId) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Exécution d'inventaire</h2>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Démarrer un inventaire</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pendingInventories.length > 0 && (
                <div>
                  <Label>Inventaire programmé (optionnel)</Label>
                  <Select value={selectedScheduleId || '__none__'} onValueChange={v => setSelectedScheduleId(v === '__none__' ? null : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Ad-hoc (sans programme)</SelectItem>
                      {pendingInventories.map(inv => (
                        <SelectItem key={inv.id} value={inv.id}>
                          {new Date(inv.scheduled_date).toLocaleString('fr-FR')}
                          {inv.status === 'overdue' ? ' ⚠️ En retard' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={startSession} className="w-full gap-2">
                <ClipboardCheck className="w-4 h-4" /> Lancer l'inventaire
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Active session
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Inventaire en cours</h2>
        <Badge variant="secondary">{completedChecks.length} / {boxes.length} boxes</Badge>
      </div>

      <Progress value={boxes.length ? (completedChecks.length / boxes.length) * 100 : 0} className="h-2" />

      {/* Box selection (when no box is active) */}
      {!selectedBoxId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BoxIcon className="w-5 h-5" /> Sélectionner une box
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {boxes.map(box => {
                const done = completedChecks.find(c => c.box_id === box.id);
                const parcelCount = allParcelsByBox[box.id]?.length || 0;
                return (
                  <button
                    key={box.id}
                    onClick={() => !done && selectBox(box.id)}
                    disabled={!!done}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      done
                        ? 'bg-primary/10 border-primary/30 opacity-70'
                        : 'bg-secondary/50 border-border/50 hover:bg-secondary hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium text-sm flex items-center gap-1">
                      {done && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                      {box.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{parcelCount} colis</p>
                    {done && done.missing.length > 0 && (
                      <p className="text-xs text-destructive mt-1">{done.missing.length} manquant(s)</p>
                    )}
                  </button>
                );
              })}
            </div>

            {allBoxesChecked && (
              <div className="mt-6 text-center">
                <Button onClick={() => setShowCloseDialog(true)} size="lg" className="gap-2">
                  <ClipboardCheck className="w-5 h-5" /> Clôturer l'inventaire
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active box scanning */}
      {selectedBoxId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ScanLine className="w-5 h-5" />
              {boxes.find(b => b.id === selectedBoxId)?.name}
              <Badge variant="outline" className="ml-auto">
                {scannedTrackings.size} / {expectedParcels.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Scan input */}
            <Input
              ref={scanRef}
              value={scanInput}
              onChange={(e) => setScanInput(e.target.value)}
              onKeyDown={handleScan}
              placeholder="Scanner un colis..."
              autoFocus
              className="text-lg font-mono"
            />

            {/* Expected parcels list */}
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {expectedParcels.map(p => {
                const isScanned = scannedTrackings.has(p.tracking);
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${
                      isScanned ? 'bg-primary/10 text-primary' : 'bg-secondary/30'
                    }`}
                  >
                    {isScanned ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30 shrink-0" />
                    )}
                    <span className="font-mono">{p.tracking}</span>
                    {p.boutique && <span className="text-xs text-muted-foreground ml-auto">{p.boutique}</span>}
                  </div>
                );
              })}
            </div>

            {/* Extra trackings */}
            {extraTrackings.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-sm font-medium text-destructive flex items-center gap-1 mb-2">
                  <XCircle className="w-4 h-4" /> Excédentaires ({extraTrackings.length})
                </p>
                <div className="space-y-1">
                  {extraTrackings.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1 rounded bg-destructive/10 text-sm">
                      <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                      <span className="font-mono">{t}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => { setSelectedBoxId(null); setExpectedParcels([]); setScannedTrackings(new Set()); setExtraTrackings([]); }}>
                Annuler
              </Button>
              <Button onClick={finishBox} className="flex-1 gap-1">
                <CheckCircle2 className="w-4 h-4" /> Terminer cette box
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary of completed checks */}
      {completedChecks.length > 0 && !selectedBoxId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Résumé des vérifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedChecks.map((check, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/50 border border-border/50">
                  <div>
                    <p className="font-medium text-sm">{check.box_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {check.actual_count} / {check.expected_count} scannés
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {check.missing.length > 0 && (
                      <Badge variant="destructive" className="text-xs">{check.missing.length} manquant(s)</Badge>
                    )}
                    {check.extra.length > 0 && (
                      <Badge variant="outline" className="text-xs">{check.extra.length} extra</Badge>
                    )}
                    {check.missing.length === 0 && check.extra.length === 0 && (
                      <Badge className="text-xs">✓ OK</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Close inventory dialog */}
      <Dialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clôturer l'inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {completedChecks.length} boxes vérifiées sur {boxes.length}.
              {completedChecks.some(c => c.missing.length > 0) && (
                <span className="text-destructive"> Des écarts ont été détectés.</span>
              )}
            </p>
            <div>
              <Label>Notes (optionnel)</Label>
              <Textarea value={closeNotes} onChange={e => setCloseNotes(e.target.value)} placeholder="Remarques..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCloseDialog(false)}>Annuler</Button>
            <Button onClick={closeInventory} disabled={closing}>
              {closing ? 'Clôture...' : 'Clôturer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventoryExecution;
