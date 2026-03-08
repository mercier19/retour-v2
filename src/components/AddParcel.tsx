import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useConsolidationSettings } from '@/hooks/useConsolidationSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, QrCode, Settings } from 'lucide-react';
import { Box } from '@/types/database';
import ConsolidationBanner from '@/components/ConsolidationBanner';
import { useSound } from '@/hooks/useSound';

const AddParcel: React.FC = () => {
  const { warehouseId, showAll, hasRole } = useWarehouseFilter();
  const consolidation = useConsolidationSettings();
  const { playSuccess, playError, playPart } = useSound();
  const [showSettings, setShowSettings] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tracking, setTracking] = useState('');
  const [boxId, setBoxId] = useState('');
  const [boutique, setBoutique] = useState('');
  const [boutiques, setBoutiques] = useState<string[]>([]);
  const [boutiqueSearch, setBoutiqueSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'qr'>('qr');
  const [qrInput, setQrInput] = useState('');

  // Multi-part state
  const [isMultiPart, setIsMultiPart] = useState(false);
  const [totalParts, setTotalParts] = useState(2);

  // Dialog for QR multi-part prompt
  const [multiPartDialog, setMultiPartDialog] = useState(false);
  const [pendingInsert, setPendingInsert] = useState<any>(null);
  const [dialogTotalParts, setDialogTotalParts] = useState(2);

  useEffect(() => {
    if (warehouseId) loadBoxes();
    loadBoutiques();
  }, [warehouseId]);

  const loadBoxes = async () => {
    if (!warehouseId) return;
    const { data } = await supabase
      .from('boxes')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('name');
    setBoxes((data as Box[]) || []);
  };

  const loadBoutiques = async () => {
    const { data: activeParcels } = await supabase
      .from('parcels')
      .select('boutique')
      .not('boutique', 'is', null);
    const { data: archivedParcels } = await supabase
      .from('archived_parcels')
      .select('boutique')
      .not('boutique', 'is', null);

    const allBoutiques = new Set<string>();
    activeParcels?.forEach((p) => { if (p.boutique) allBoutiques.add(p.boutique); });
    archivedParcels?.forEach((p) => { if (p.boutique) allBoutiques.add(p.boutique); });
    setBoutiques(Array.from(allBoutiques).sort());
  };

  const filteredBoutiques = boutiques.filter((b) =>
    b.toLowerCase().includes(boutiqueSearch.toLowerCase())
  );

  const insertParcel = async (parcelData: any) => {
    const { error } = await supabase.from('parcels').insert(parcelData);
    return error;
  };

  const handleDuplicate = async (parcelData: any) => {
    // Check if existing parcel with this tracking is multi-part
    const { data: existing } = await supabase
      .from('parcels')
      .select('is_multi_part, part_number, total_parts')
      .eq('warehouse_id', parcelData.warehouse_id)
      .eq('tracking', parcelData.tracking)
      .order('part_number', { ascending: false })
      .limit(1);

    if (!existing || existing.length === 0) {
      toast.error('Ce tracking existe déjà dans ce dépôt');
      return;
    }

    const latest = existing[0];

    if (latest.is_multi_part) {
      const nextPart = latest.part_number + 1;
      if (nextPart > latest.total_parts) {
        toast.warning(`Toutes les ${latest.total_parts} parties de ce tracking ont déjà été reçues`);
        playError();
        return;
      }
      const error = await insertParcel({
        ...parcelData,
        is_multi_part: true,
        part_number: nextPart,
        total_parts: latest.total_parts,
      });
      if (error) {
        toast.error(error.message);
        playError();
      } else {
        toast.success(`Partie ${nextPart}/${latest.total_parts} ajoutée pour ${parcelData.tracking}`);
        playPart();
      }
    } else {
      // Not multi-part yet — prompt user
      setPendingInsert(parcelData);
      setDialogTotalParts(2);
      setMultiPartDialog(true);
    }
  };

  const confirmConvertToMultiPart = async () => {
    if (!pendingInsert) return;
    setMultiPartDialog(false);
    setLoading(true);

    // Convert existing parcel to multi-part
    await supabase
      .from('parcels')
      .update({ is_multi_part: true, part_number: 1, total_parts: dialogTotalParts })
      .eq('warehouse_id', pendingInsert.warehouse_id)
      .eq('tracking', pendingInsert.tracking);

    // Insert part 2
    const error = await insertParcel({
      ...pendingInsert,
      is_multi_part: true,
      part_number: 2,
      total_parts: dialogTotalParts,
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`Converti en multi-parties (${dialogTotalParts}). Partie 2/${dialogTotalParts} ajoutée.`);
    }
    setPendingInsert(null);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !tracking.trim()) {
      if (showAll) toast.error('Veuillez sélectionner un dépôt spécifique pour ajouter un colis');
      return;
    }
    if (!boxId) {
      toast.error('Veuillez sélectionner une palette');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setLoading(true);

    const parcelData: any = {
      warehouse_id: warehouseId,
      tracking: tracking.trim(),
      box_id: boxId || null,
      boutique: boutique.trim() || null,
      added_by: user?.id || null,
      is_multi_part: isMultiPart,
      part_number: 1,
      total_parts: isMultiPart ? totalParts : 1,
    };

    const error = await insertParcel(parcelData);

    if (error) {
      if (error.code === '23505') {
        await handleDuplicate(parcelData);
      } else {
        toast.error('Erreur: ' + error.message);
      }
    } else {
      const msg = isMultiPart ? `Partie 1/${totalParts} ajoutée` : 'Colis ajouté avec succès';
      toast.success(msg);
      setTracking('');
      setBoutique('');
      setBoutiqueSearch('');
    }
    setLoading(false);
  };

  const handleQrScan = async () => {
    if (!qrInput.trim() || !warehouseId) {
      if (showAll) toast.error('Veuillez sélectionner un dépôt spécifique');
      return;
    }
    if (!boxId) {
      toast.error('Veuillez sélectionner une palette');
      return;
    }
    const parts = qrInput.split(',');
    const t = parts[1]?.trim();
    if (!t) { toast.error('Format QR invalide'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    setLoading(true);

    const parcelData: any = {
      warehouse_id: warehouseId,
      tracking: t,
      box_id: boxId || null,
      boutique: parts[3]?.trim() || null,
      wilaya: parts[0]?.trim() || null,
      commune: parts[2]?.trim() || null,
      phone: parts[8]?.trim() || null,
      added_by: user?.id || null,
    };

    const error = await insertParcel(parcelData);

    if (error) {
      if (error.code === '23505') {
        await handleDuplicate(parcelData);
      } else {
        toast.error(error.message);
        playError();
      }
    } else {
      toast.success(`Colis ${t} ajouté`);
      playSuccess();
    }
    setQrInput('');
    setLoading(false);
  };

  if (showAll) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Ajouter des colis</h1>
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Veuillez sélectionner un dépôt spécifique pour ajouter des colis.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Ajouter des colis</h1>
          {hasRole('chef_agence', 'regional', 'super_admin') && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSettings(!showSettings)}
              title="Paramètres de regroupement"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')}>
            <Plus className="w-4 h-4 mr-1" /> Manuel
          </Button>
          <Button variant={mode === 'qr' ? 'default' : 'outline'} size="sm" onClick={() => setMode('qr')}>
            <QrCode className="w-4 h-4 mr-1" /> Scanner
          </Button>
        </div>
      </div>

      {/* Consolidation settings panel */}
      {showSettings && hasRole('chef_agence', 'regional', 'super_admin') && (
        <Card className="border-muted">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="consolidation-toggle" className="cursor-pointer">
                Activer suggestion de regroupement
              </Label>
              <Switch
                id="consolidation-toggle"
                checked={consolidation.enabled}
                onCheckedChange={consolidation.setEnabled}
              />
            </div>
            {consolidation.enabled && (
              <div className="flex items-center gap-3">
                <Label>Seuil (nombre de colis)</Label>
                <Input
                  type="number"
                  min={1}
                  value={consolidation.threshold}
                  onChange={(e) => consolidation.setThreshold(parseInt(e.target.value) || 10)}
                  className="w-20"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Consolidation suggestions */}
      {warehouseId && (
        <ConsolidationBanner
          warehouseId={warehouseId}
          threshold={consolidation.threshold}
          enabled={consolidation.enabled}
          onConsolidated={loadBoxes}
        />
      )}

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === 'manual' ? 'Saisie manuelle' : 'Mode scanner'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Box selector - required */}
          <div className="mb-4">
            <Label>Palette *</Label>
            <Select value={boxId} onValueChange={setBoxId} required>
              <SelectTrigger className={!boxId ? 'border-destructive/50' : ''}>
                <SelectValue placeholder="Sélectionner une palette" />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((box) => (
                  <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Boutique selector - manual mode only */}
          {mode === 'manual' && (
            <div className="mb-4">
              <Label>Boutique</Label>
              <Select value={boutique} onValueChange={setBoutique}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une boutique" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="Rechercher une boutique..."
                      value={boutiqueSearch}
                      onChange={(e) => setBoutiqueSearch(e.target.value)}
                      className="mb-2"
                    />
                  </div>
                  {filteredBoutiques.length > 0 ? (
                    filteredBoutiques.slice(0, 50).map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground p-2 text-center">Aucune boutique trouvée</p>
                  )}
                </SelectContent>
              </Select>
              {boutique && (
                <button onClick={() => { setBoutique(''); setBoutiqueSearch(''); }} className="text-xs text-muted-foreground mt-1 hover:text-foreground">
                  ✕ Effacer la boutique
                </button>
              )}
            </div>
          )}

          {/* Multi-part checkbox - manual mode only */}
          {mode === 'manual' && (
            <div className="mb-4 space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="multipart"
                  checked={isMultiPart}
                  onCheckedChange={(c) => setIsMultiPart(!!c)}
                />
                <Label htmlFor="multipart" className="cursor-pointer">Ce colis a plusieurs parties</Label>
              </div>
              {isMultiPart && (
                <div className="ml-6">
                  <Label>Nombre total de parties</Label>
                  <Input
                    type="number"
                    min={2}
                    max={99}
                    value={totalParts}
                    onChange={(e) => setTotalParts(Math.max(2, parseInt(e.target.value) || 2))}
                    className="w-24"
                  />
                </div>
              )}
            </div>
          )}

          {mode === 'manual' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tracking *</Label>
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Numéro de tracking" required autoFocus />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Ajout...' : 'Ajouter le colis'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Données QR (format CSV)</Label>
                <Input
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleQrScan()}
                  placeholder="Scannez ou collez les données QR"
                  autoFocus
                />
              </div>
              <Button onClick={handleQrScan} disabled={loading || !qrInput.trim()}>
                {loading ? 'Ajout...' : 'Valider'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Multi-part prompt dialog (for QR duplicate detection) */}
      <Dialog open={multiPartDialog} onOpenChange={setMultiPartDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ce tracking a plusieurs parties ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Le tracking <span className="font-mono font-medium">{pendingInsert?.tracking}</span> existe déjà. 
            S'il s'agit d'un colis multi-parties, indiquez le nombre total.
          </p>
          <div className="space-y-2">
            <Label>Nombre total de parties</Label>
            <Input
              type="number"
              min={2}
              max={99}
              value={dialogTotalParts}
              onChange={(e) => setDialogTotalParts(Math.max(2, parseInt(e.target.value) || 2))}
              className="w-24"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMultiPartDialog(false); setPendingInsert(null); }}>
              Annuler
            </Button>
            <Button onClick={confirmConvertToMultiPart}>
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddParcel;
