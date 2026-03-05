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
  const { warehouseId } = useWarehouseFilter();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tracking, setTracking] = useState('');
  const [boxId, setBoxId] = useState('');
  const [boutique, setBoutique] = useState('');
  const [wilaya, setWilaya] = useState('');
  const [commune, setCommune] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'manual' | 'qr'>('manual');
  const [qrInput, setQrInput] = useState('');

  useEffect(() => {
    if (warehouseId) loadBoxes();
  }, [warehouseId]);

  const loadBoxes = async () => {
    const { data } = await supabase
      .from('boxes')
      .select('*')
      .eq('warehouse_id', warehouseId!)
      .order('name');
    setBoxes((data as Box[]) || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseId || !tracking.trim()) return;

    setLoading(true);
    const { error } = await supabase.from('parcels').insert({
      warehouse_id: warehouseId,
      tracking: tracking.trim(),
      box_id: boxId || null,
      boutique: boutique.trim() || null,
      wilaya: wilaya.trim() || null,
      commune: commune.trim() || null,
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
      setWilaya('');
      setCommune('');
    }
    setLoading(false);
  };

  const handleQrScan = async () => {
    if (!qrInput.trim() || !warehouseId) return;
    // Parse QR: expected format "tracking|boutique|wilaya|commune"
    const parts = qrInput.split('|');
    const t = parts[0]?.trim();
    if (!t) { toast.error('Format QR invalide'); return; }

    setLoading(true);
    const { error } = await supabase.from('parcels').insert({
      warehouse_id: warehouseId,
      tracking: t,
      box_id: boxId || null,
      boutique: parts[1]?.trim() || null,
      wilaya: parts[2]?.trim() || null,
      commune: parts[3]?.trim() || null,
    });

    if (error) {
      toast.error(error.code === '23505' ? 'Tracking déjà existant' : error.message);
    } else {
      toast.success(`Colis ${t} ajouté`);
    }
    setQrInput('');
    setLoading(false);
  };

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
          {/* Box selector shared between modes */}
          <div className="mb-4">
            <Label>Boîte</Label>
            <Select value={boxId} onValueChange={setBoxId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une boîte (optionnel)" />
              </SelectTrigger>
              <SelectContent>
                {boxes.map((box) => (
                  <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {mode === 'manual' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tracking *</Label>
                <Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="Numéro de tracking" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Boutique</Label>
                  <Input value={boutique} onChange={(e) => setBoutique(e.target.value)} placeholder="Nom boutique" />
                </div>
                <div className="space-y-2">
                  <Label>Wilaya</Label>
                  <Input value={wilaya} onChange={(e) => setWilaya(e.target.value)} placeholder="Wilaya" />
                </div>
                <div className="space-y-2">
                  <Label>Commune</Label>
                  <Input value={commune} onChange={(e) => setCommune(e.target.value)} placeholder="Commune" />
                </div>
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? 'Ajout...' : 'Ajouter le colis'}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Données QR (tracking|boutique|wilaya|commune)</Label>
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
