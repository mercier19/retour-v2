import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, Trash2, Edit2, Check, X, FileDown } from 'lucide-react';
import { Box } from '@/types/database';
import { printBoxPDF } from '@/lib/box-pdf';

const Boxes: React.FC = () => {
  const { warehouseId, showAll, currentWarehouse } = useWarehouseFilter();
  const [boxes, setBoxes] = useState<(Box & { parcel_count: number })[]>([]);
  const [newName, setNewName] = useState('');
  const [newQuota, setNewQuota] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editQuota, setEditQuota] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (warehouseId) loadBoxes();
  }, [warehouseId]);

  const loadBoxes = async () => {
    if (!warehouseId) return;
    const { data } = await supabase.from('boxes').select('*').eq('warehouse_id', warehouseId).order('name');
    if (data) {
      const withCounts = await Promise.all(
        (data as Box[]).map(async (box) => {
          const { count } = await supabase.from('parcels').select('id', { count: 'exact', head: true }).eq('box_id', box.id);
          return { ...box, parcel_count: count || 0 };
        })
      );
      setBoxes(withCounts);
    }
  };

  const createBox = async () => {
    if (!warehouseId || !newName.trim()) {
      if (showAll) toast.error('Veuillez sélectionner un dépôt spécifique');
      if (!newName.trim()) toast.error('Le nom est requis');
      return;
    }
    setCreating(true);
    const { error } = await supabase.from('boxes').insert({
      warehouse_id: warehouseId,
      name: newName.trim(),
      quota: newQuota ? parseInt(newQuota) : 0,
    });
    if (error) {
      toast.error(error.code === '23505' ? 'Ce nom existe déjà' : error.message);
    } else {
      toast.success('Box créée');
      setNewName('');
      setNewQuota('');
      loadBoxes();
    }
    setCreating(false);
  };

  const updateBox = async (id: string) => {
    const { error } = await supabase.from('boxes').update({
      name: editName.trim(),
      quota: editQuota ? parseInt(editQuota) : null,
    }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Box modifiée'); setEditingId(null); loadBoxes(); }
  };

  const deleteBox = async (id: string) => {
    if (!confirm('Supprimer cette box ?')) return;
    const { error } = await supabase.from('boxes').delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Box supprimée'); loadBoxes(); }
  };

  if (showAll) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Gestion des boxes</h1>
        <Card className="glass-card">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Veuillez sélectionner un dépôt spécifique pour gérer les boxes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gestion des boxes</h1>

      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Nouvelle box</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de la box"
                onKeyDown={(e) => e.key === 'Enter' && createBox()}
              />
            </div>
            <div className="w-24">
              <Input value={newQuota} onChange={(e) => setNewQuota(e.target.value)} placeholder="Quota" type="number" />
            </div>
            <Button onClick={createBox} disabled={!newName.trim() || creating}>
              <Plus className="w-4 h-4 mr-1" /> Créer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {boxes.map((box) => (
          <Card key={box.id} className="glass-card">
            <CardContent className="p-4">
              {editingId === box.id ? (
                <div className="flex gap-3 items-center">
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1" />
                  <Input value={editQuota} onChange={(e) => setEditQuota(e.target.value)} className="w-24" type="number" placeholder="Quota" />
                  <Button size="icon" variant="ghost" onClick={() => updateBox(box.id)}><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{box.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {box.parcel_count} colis {box.quota ? `/ ${box.quota}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => printBoxPDF({ boxId: box.id, boxName: box.name, warehouseName: currentWarehouse?.name || '' })} title="Imprimer PDF">
                      <FileDown className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditingId(box.id); setEditName(box.name); setEditQuota(String(box.quota || '')); }}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteBox(box.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {boxes.length === 0 && <p className="text-muted-foreground text-center py-8">Aucune box</p>}
      </div>
    </div>
  );
};

export default Boxes;
