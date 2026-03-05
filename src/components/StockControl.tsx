import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Trash2, Download, Archive } from 'lucide-react';
import { Box } from '@/types/database';

const StockControl: React.FC = () => {
  const { warehouseId, currentWarehouse, showAll } = useWarehouseFilter();
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [selectedBox, setSelectedBox] = useState('');

  useEffect(() => {
    if (warehouseId) loadBoxes();
  }, [warehouseId]);

  const loadBoxes = async () => {
    if (!warehouseId) return;
    const { data } = await supabase.from('boxes').select('*').eq('warehouse_id', warehouseId).order('name');
    setBoxes((data as Box[]) || []);
  };

  const clearBox = async () => {
    if (!selectedBox || !confirm('Vider cette boîte ? Les colis seront archivés.')) return;
    const box = boxes.find((b) => b.id === selectedBox);

    const { data: parcels } = await supabase.from('parcels').select('*').eq('box_id', selectedBox);
    if (parcels && parcels.length > 0) {
      await supabase.from('archived_parcels').insert(
        parcels.map((p: any) => ({
          warehouse_id: p.warehouse_id,
          tracking: p.tracking,
          box_name: box?.name,
          boutique: p.boutique,
          wilaya: p.wilaya,
          commune: p.commune,
          status: p.status,
          created_at: p.created_at,
        }))
      );
      await supabase.from('parcels').delete().eq('box_id', selectedBox);
      toast.success(`${parcels.length} colis archivés de ${box?.name}`);
    } else {
      toast.info('Boîte déjà vide');
    }
  };

  const clearAllStock = async () => {
    if (!warehouseId || !confirm('Vider TOUT le stock de ce dépôt ? Tous les colis seront archivés.')) return;

    const { data: parcels } = await supabase.from('parcels').select('*, boxes(name)').eq('warehouse_id', warehouseId);
    if (parcels && parcels.length > 0) {
      await supabase.from('archived_parcels').insert(
        parcels.map((p: any) => ({
          warehouse_id: p.warehouse_id,
          tracking: p.tracking,
          box_name: p.boxes?.name,
          boutique: p.boutique,
          wilaya: p.wilaya,
          commune: p.commune,
          status: p.status,
          created_at: p.created_at,
        }))
      );
      await supabase.from('parcels').delete().eq('warehouse_id', warehouseId);
      toast.success(`${parcels.length} colis archivés`);
    } else {
      toast.info('Stock déjà vide');
    }
  };

  const generateCsv = (rows: any[], filename: string) => {
    if (rows.length === 0) { toast.info('Aucun colis à exporter'); return; }

    const headers = ['Tracking', 'Boîte', 'Boutique', 'Wilaya', 'Commune', 'Statut', 'Manquant', 'Date'];
    const csvRows = rows.map((p: any) => [
      p.tracking,
      p.box_name || p.boxes?.name || '',
      p.boutique || '',
      p.wilaya || '',
      p.commune || '',
      p.status || '',
      p.is_missing ? 'Oui' : 'Non',
      new Date(p.created_at).toLocaleDateString('fr-FR'),
    ]);

    const csv = [headers, ...csvRows].map((r) => r.map((c: string) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Export téléchargé');
  };

  const exportActive = async () => {
    if (!warehouseId) return;
    const { data } = await supabase
      .from('parcels')
      .select('*, boxes(name)')
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    generateCsv(data || [], `stock_actif_${currentWarehouse?.code || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  const exportAll = async () => {
    if (!warehouseId) return;

    // Fetch active parcels
    const { data: active } = await supabase
      .from('parcels')
      .select('*, boxes(name)')
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    // Fetch archived parcels
    const { data: archived } = await supabase
      .from('archived_parcels')
      .select('*')
      .eq('warehouse_id', warehouseId)
      .order('created_at', { ascending: false });

    const activeMapped = (active || []).map((p: any) => ({
      ...p,
      box_name: p.boxes?.name || '',
    }));

    const allParcels = [...activeMapped, ...(archived || [])];
    generateCsv(allParcels, `stock_complet_${currentWarehouse?.code || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
  };

  if (showAll) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Contrôle de stock</h1>
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Veuillez sélectionner un dépôt spécifique pour le contrôle de stock.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Contrôle de stock</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Vider une boîte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedBox} onValueChange={setSelectedBox}>
            <SelectTrigger>
              <SelectValue placeholder="Sélectionner une boîte" />
            </SelectTrigger>
            <SelectContent>
              {boxes.map((box) => (
                <SelectItem key={box.id} value={box.id}>{box.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" onClick={clearBox} disabled={!selectedBox}>
            <Trash2 className="w-4 h-4 mr-1" /> Vider et archiver
          </Button>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardContent className="p-4">
          <Button variant="destructive" onClick={clearAllStock} className="w-full">
            <Archive className="w-4 h-4 mr-1" /> Vider tout le stock
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">Archive tous les colis du dépôt</p>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Exporter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={exportActive} className="w-full">
            <Download className="w-4 h-4 mr-1" /> Exporter stock actif (CSV)
          </Button>
          <Button variant="outline" onClick={exportAll} className="w-full">
            <Download className="w-4 h-4 mr-1" /> Exporter tout (actif + archivé) (CSV)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default StockControl;
