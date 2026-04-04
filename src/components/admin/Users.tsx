import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Building2, FileSpreadsheet } from 'lucide-react';
import { Profile, Warehouse, AppRole } from '@/types/database';
import ExcelImportModal from '@/components/ExcelImportModal';

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'operations', label: 'Opérations' },
  { value: 'chef_agence', label: "Chef d'agence" },
  { value: 'regional', label: 'Régional' },
  { value: 'super_admin', label: 'Super Admin' },
];

const Users: React.FC = () => {
  const [users, setUsers] = useState<(Profile & { warehouses: Warehouse[] })[]>([]);
  const [allWarehouses, setAllWarehouses] = useState<Warehouse[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('operations');
  const [newWarehouseIds, setNewWarehouseIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [profilesRes, warehousesRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('warehouses').select('*').order('name'),
    ]);

    const profiles = (profilesRes.data as Profile[]) || [];
    setAllWarehouses((warehousesRes.data as Warehouse[]) || []);

    // Load warehouse assignments for each user
    const usersWithWarehouses = await Promise.all(
      profiles.map(async (profile) => {
        const { data: assignments } = await supabase
          .from('user_warehouses')
          .select('warehouse_id')
          .eq('user_id', profile.id);
        const warehouseIds = (assignments || []).map((a) => a.warehouse_id);
        const warehouses = (warehousesRes.data as Warehouse[])?.filter((w) => warehouseIds.includes(w.id)) || [];
        return { ...profile, warehouses };
      })
    );
    setUsers(usersWithWarehouses);
  };

  const createUser = async () => {
    if (!newEmail || !newPassword) return;
    setLoading(true);

    // Create user via admin function - we'll use supabase auth admin
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: newEmail,
      password: newPassword,
      options: { data: { full_name: newFullName } },
    });

    if (authError) {
      toast.error(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Update profile role
      await supabase.from('profiles').update({ role: newRole, full_name: newFullName }).eq('id', authData.user.id);

      // Assign warehouses
      if (newWarehouseIds.length > 0) {
        await supabase.from('user_warehouses').insert(
          newWarehouseIds.map((wid) => ({ user_id: authData.user!.id, warehouse_id: wid }))
        );
      }

      toast.success('Utilisateur créé');
      setShowCreate(false);
      setNewEmail('');
      setNewPassword('');
      setNewFullName('');
      setNewRole('operations');
      setNewWarehouseIds([]);
      loadData();
    }
    setLoading(false);
  };

  const updateRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from('profiles').update({ role }).eq('id', userId);
    if (error) toast.error(error.message);
    else { toast.success('Rôle mis à jour'); loadData(); }
  };

  const addWarehouse = async (userId: string, warehouseId: string) => {
    const { error } = await supabase.from('user_warehouses').insert({ user_id: userId, warehouse_id: warehouseId });
    if (error) toast.error(error.code === '23505' ? 'Déjà assigné' : error.message);
    else { toast.success('Dépôt assigné'); loadData(); }
  };

  const removeWarehouse = async (userId: string, warehouseId: string) => {
    const { error } = await supabase.from('user_warehouses').delete().eq('user_id', userId).eq('warehouse_id', warehouseId);
    if (error) toast.error(error.message);
    else { toast.success('Dépôt retiré'); loadData(); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Gestion des utilisateurs</h1>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Créer un utilisateur</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nouveau utilisateur</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={newFullName} onChange={(e) => setNewFullName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Mot de passe</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Rôle</Label>
                <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dépôts</Label>
                <div className="flex flex-wrap gap-2">
                  {allWarehouses.map((w) => (
                    <Badge
                      key={w.id}
                      variant={newWarehouseIds.includes(w.id) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => {
                        setNewWarehouseIds((prev) =>
                          prev.includes(w.id) ? prev.filter((id) => id !== w.id) : [...prev, w.id]
                        );
                      }}
                    >
                      {w.name}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={createUser} disabled={loading || !newEmail || !newPassword} className="w-full">
                {loading ? 'Création...' : 'Créer'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <Card key={user.id} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{user.full_name || user.email}</p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Select value={user.role} onValueChange={(v) => updateRole(user.id, v as AppRole)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Building2 className="w-3 h-3" /> Dépôts assignés</p>
                <div className="flex flex-wrap gap-1">
                  {user.warehouses.map((w) => (
                    <Badge key={w.id} variant="secondary" className="gap-1">
                      {w.name}
                      <button onClick={() => removeWarehouse(user.id, w.id)} className="ml-1 hover:text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                  <Select onValueChange={(wid) => addWarehouse(user.id, wid)}>
                    <SelectTrigger className="h-6 w-6 p-0 border-dashed">
                      <Plus className="w-3 h-3" />
                    </SelectTrigger>
                    <SelectContent>
                      {allWarehouses.filter((w) => !user.warehouses.some((uw) => uw.id === w.id)).map((w) => (
                        <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Users;
