import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWarehouseFilter } from '@/hooks/useWarehouseFilter';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, Plus, Pencil, Trash2, RefreshCw, X } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

interface ScheduledInventory {
  id: string;
  warehouse_id: string;
  scheduled_date: string;
  created_by: string | null;
  status: string;
  is_recurring: boolean;
  interval_days: number | null;
  created_at: string;
}

const STATUS_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'En attente', variant: 'secondary' },
  completed: { label: 'Terminé', variant: 'default' },
  overdue: { label: 'En retard', variant: 'destructive' },
  cancelled: { label: 'Annulé', variant: 'outline' },
};

const InventorySchedule: React.FC = () => {
  const { warehouseIds } = useWarehouseFilter();
  const { warehouses, profile } = useAuth();
  const [inventories, setInventories] = useState<ScheduledInventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formWarehouse, setFormWarehouse] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formRecurring, setFormRecurring] = useState(false);
  const [formInterval, setFormInterval] = useState(30);
  const [saving, setSaving] = useState(false);
  const [creatorNames, setCreatorNames] = useState<Record<string, string>>({});

  // Filter
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    if (warehouseIds.length > 0) loadInventories();
  }, [warehouseIds.length]);

  const loadInventories = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scheduled_inventories')
      .select('*')
      .in('warehouse_id', warehouseIds)
      .order('scheduled_date', { ascending: false });

    if (data) {
      const invs = data as unknown as ScheduledInventory[];
      setInventories(invs);
      // Load creator names
      const creatorIds = [...new Set(invs.map(i => i.created_by).filter(Boolean))] as string[];
      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', creatorIds);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach((p: any) => { map[p.id] = p.full_name || p.id.substring(0, 8); });
          setCreatorNames(map);
        }
      }
    }
    if (error) toast.error('Erreur chargement: ' + error.message);
    setLoading(false);
  };

  const resetForm = () => {
    setFormWarehouse('');
    setFormDate('');
    setFormRecurring(false);
    setFormInterval(30);
    setEditingId(null);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (inv: ScheduledInventory) => {
    setEditingId(inv.id);
    setFormWarehouse(inv.warehouse_id);
    setFormDate(inv.scheduled_date.substring(0, 16));
    setFormRecurring(inv.is_recurring);
    setFormInterval(inv.interval_days || 30);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formWarehouse || !formDate) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('scheduled_inventories')
        .update({
          warehouse_id: formWarehouse,
          scheduled_date: new Date(formDate).toISOString(),
          is_recurring: formRecurring,
          interval_days: formRecurring ? formInterval : null,
        })
        .eq('id', editingId);

      if (error) toast.error('Erreur: ' + error.message);
      else toast.success('Inventaire modifié');
    } else {
      const { error } = await supabase
        .from('scheduled_inventories')
        .insert({
          warehouse_id: formWarehouse,
          scheduled_date: new Date(formDate).toISOString(),
          created_by: profile?.id,
          is_recurring: formRecurring,
          interval_days: formRecurring ? formInterval : null,
        });

      if (error) toast.error('Erreur: ' + error.message);
      else toast.success('Inventaire programmé');
    }

    setSaving(false);
    setShowForm(false);
    resetForm();
    loadInventories();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_inventories')
      .update({ status: 'cancelled' })
      .eq('id', id);

    if (error) toast.error('Erreur: ' + error.message);
    else {
      toast.success('Inventaire annulé');
      loadInventories();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from('scheduled_inventories')
      .delete()
      .eq('id', id);

    if (error) toast.error('Erreur: ' + error.message);
    else {
      toast.success('Inventaire supprimé');
      loadInventories();
    }
  };

  const warehouseNameMap = Object.fromEntries(warehouses.map(w => [w.id, w.name]));

  const filtered = filterStatus === 'all'
    ? inventories
    : inventories.filter(i => i.status === filterStatus);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Planification des inventaires</h2>
        <Button onClick={openCreate} size="sm" className="gap-1">
          <Plus className="w-4 h-4" /> Programmer
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="completed">Terminés</SelectItem>
            <SelectItem value="overdue">En retard</SelectItem>
            <SelectItem value="cancelled">Annulés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">Aucun inventaire programmé</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                 <TableHead>Dépôt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Créé par</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Récurrent</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((inv) => {
                  const badge = STATUS_BADGES[inv.status] || STATUS_BADGES.pending;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{warehouseNameMap[inv.warehouse_id] || '?'}</TableCell>
                      <TableCell>{format(new Date(inv.scheduled_date), 'dd/MM/yyyy HH:mm', { locale: fr })}</TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell>
                        {inv.is_recurring ? (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <RefreshCw className="w-3 h-3" /> {inv.interval_days}j
                          </span>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === 'pending' && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(inv)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleCancel(inv.id)}>
                                <X className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {(inv.status === 'cancelled' || inv.status === 'completed') && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(inv.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Modifier' : 'Programmer'} un inventaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Dépôt</Label>
              <Select value={formWarehouse} onValueChange={setFormWarehouse}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un dépôt" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.filter(w => warehouseIds.includes(w.id)).map(w => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date et heure</Label>
              <Input
                type="datetime-local"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={formRecurring} onCheckedChange={setFormRecurring} />
              <Label>Inventaire récurrent</Label>
            </div>
            {formRecurring && (
              <div>
                <Label>Tous les X jours</Label>
                <Input
                  type="number"
                  min={1}
                  value={formInterval}
                  onChange={(e) => setFormInterval(parseInt(e.target.value) || 30)}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Annuler</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'En cours...' : editingId ? 'Modifier' : 'Programmer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InventorySchedule;
