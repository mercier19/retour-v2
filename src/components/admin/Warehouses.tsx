import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Edit2, Check, X, FileSpreadsheet } from 'lucide-react';
import { Warehouse } from '@/types/database';
import ExcelImportModal from '@/components/ExcelImportModal';

const TYPES = [
  { value: 'centre_tri', label: 'Centre de tri' },
  { value: 'agence', label: 'Agence' },
  { value: 'desk', label: 'Desk' },
];

const Warehouses: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('agence');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editType, setEditType] = useState('');
  const [showImport, setShowImport] = useState(false);
  useEffect(() => { loadWarehouses(); }, []);

  const loadWarehouses = async () => {
    const { data } = await supabase.from('warehouses').select('*').order('code');
    setWarehouses((data as Warehouse[]) || []);
  };

  const createWarehouse = async () => {
    if (!newCode.trim() || !newName.trim()) return;
    const { error } = await supabase.from('warehouses').insert({
      code: newCode.trim().toUpperCase(),
      name: newName.trim(),
      type: newType,
    });
    if (error) toast.error(error.code === '23505' ? 'Ce code existe déjà' : error.message);
    else { toast.success('Dépôt créé'); setNewCode(''); setNewName(''); loadWarehouses(); }
  };

  const updateWarehouse = async (id: string) => {
    const { error } = await supabase.from('warehouses').update({ name: editName, type: editType }).eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Dépôt modifié'); setEditingId(null); loadWarehouses(); }
  };

  const handleImportWarehouses = async (rows: Record<string, any>[]) => {
    const validTypes = ['centre_tri', 'agence', 'desk'];
    const results: { row: number; label: string; success: boolean; error?: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const row = i + 2;
      const code = String(r.code || '').trim().toUpperCase();
      const name = String(r.name || '').trim();
      const type = String(r.type || 'agence').trim();

      if (!code) { results.push({ row, label: code, success: false, error: 'Code manquant' }); continue; }
      if (!name) { results.push({ row, label: code, success: false, error: 'Nom manquant' }); continue; }
      if (!validTypes.includes(type)) { results.push({ row, label: code, success: false, error: `Type invalide: ${type}` }); continue; }

      const { error } = await supabase.from('warehouses').insert({ code, name, type });
      if (error) {
        results.push({ row, label: code, success: false, error: error.code === '23505' ? 'Code déjà existant' : error.message });
      } else {
        results.push({ row, label: code, success: true });
      }
    }

    loadWarehouses();
    return results;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestion des dépôts</h1>
        <Button variant="outline" onClick={() => setShowImport(true)}>
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Importer (Excel)
        </Button>
      </div>
      <Card className="glass-card">
        <CardHeader><CardTitle className="text-lg">Nouveau dépôt</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end flex-wrap">
            <div className="w-32">
              <Input value={newCode} onChange={(e) => setNewCode(e.target.value)} placeholder="Code (ex: AG-BLI)" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du dépôt" />
            </div>
            <div className="w-40">
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createWarehouse} disabled={!newCode.trim() || !newName.trim()}>
              <Plus className="w-4 h-4 mr-1" /> Créer
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {warehouses.map((w) => (
          <Card key={w.id} className="glass-card">
            <CardContent className="p-4">
              {editingId === w.id ? (
                <div className="flex gap-3 items-center flex-wrap">
                  <span className="font-mono text-sm text-muted-foreground w-20">{w.code}</span>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 min-w-[150px]" />
                  <Select value={editType} onValueChange={setEditType}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" onClick={() => updateWarehouse(w.id)}><Check className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEditingId(null)}><X className="w-4 h-4" /></Button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-muted-foreground">{w.code}</span>
                    <span className="font-medium">{w.name}</span>
                    <span className="text-xs text-muted-foreground">({TYPES.find((t) => t.value === w.type)?.label || w.type})</span>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => { setEditingId(w.id); setEditName(w.name); setEditType(w.type); }}>
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Warehouses;
