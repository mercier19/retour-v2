import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, QrCode } from 'lucide-react';
import { Box } from '@/types/database';

const AddParcel: React.FC = () => {
  const { warehouseId, showAll } = useWarehouseFilter();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tracking, setTracking] = useState('');
  const [boxId, setBoxId] = useState('');
  const [boutique, setBoutique] = useState('');
  const [boutiques, setBoutiques] = useState<string[]>([]);
  const [boutiqueSearch, setBoutiqueSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'qr'>('qr');
  const [qrInput, setQrInput] = useState('');

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
    // Get unique boutiques from active parcels
    const { data: activeParcels } = await supabase
      .from('parcels')
      .select('boutique')
      .not('boutique', 'is', null);
    
    // Get unique boutiques from archived parcels
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !tracking.trim()) {
      if (showAll) toast.error('Veuillez sélectionner un dépôt spécifique pour ajouter un colis');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    setLoading(true);
    const { error } = await supabase.from('parcels').insert({
      warehouse_id: warehouseId,
      tracking: tracking.trim(),
      box_id: boxId || null,
      boutique: boutique.trim() || null,
      added_by: user?.id || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast.error('Ce tracking existe déjà dans ce dépôt');
      } else {
        toast.error('Erreur: ' + error.message);
      }
    } else {
      toast.success('Colis ajouté avec succès');
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
    const parts = qrInput.split(',');
    const t = parts[1]?.trim();
    if (!t) { toast.error('Format QR invalide'); return; }

    const { data: { user } } = await supabase.auth.getUser();
    setLoading(true);
    const { error } = await supabase.from('parcels').insert({
      warehouse_id: warehouseId,
      tracking: t,
      box_id: boxId || null,
      boutique: parts[3]?.trim() || null,
      added_by: user?.id || null,
    });

    if (error) {
      toast.error(error.code === '23505' ? 'Tracking déjà existant' : error.message);
    } else {
      toast.success(`Colis ${t} ajouté`);
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
        <h1 className="text-2xl font-bold">Ajouter des colis</h1>
        <div className="flex gap-2">
          <Button variant={mode === 'manual' ? 'default' : 'outline'} size="sm" onClick={() => setMode('manual')}>
            <Plus className="w-4 h-4 mr-1" /> Manuel
          </Button>
          <Button variant={mode === 'qr' ? 'default' : 'outline'} size="sm" onClick={() => setMode('qr')}>
            <QrCode className="w-4 h-4 mr-1" /> Scanner
          </Button>
        </div>
      </div>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === 'manual' ? 'Saisie manuelle' : 'Mode scanner'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Box selector */}
          <div className="mb-4">
            <Label>Box</Label>
            <Select value={boxId} onValueChange={setBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une box (optionnel)" />
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
    </div>
  );
};

export default AddParcel;
