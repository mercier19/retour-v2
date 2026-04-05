import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Profile, AppRole } from '@/types/database';
import {
  PermissionKey, ALL_PERMISSION_KEYS, PAGE_PERMISSIONS, ACTION_PERMISSIONS,
  PERMISSION_LABELS, DEFAULT_ROLE_PERMISSIONS,
} from '@/hooks/usePermission';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Search, RotateCcw, Save, Users as UsersIcon } from 'lucide-react';

const ROLES: AppRole[] = ['operations', 'chef_agence', 'regional', 'super_admin'];
const ROLE_LABELS: Record<AppRole, string> = {
  operations: 'Opérations',
  chef_agence: "Chef d'agence",
  regional: 'Régional',
  super_admin: 'Super Admin',
};

const Permissions: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Individual section
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [editRole, setEditRole] = useState<AppRole>('operations');
  const [editPerms, setEditPerms] = useState<Record<PermissionKey, boolean>>({} as any);
  const [originalRole, setOriginalRole] = useState<AppRole>('operations');
  const [userOverrides, setUserOverrides] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [userSearch, setUserSearch] = useState('');

  // Bulk section
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [bulkRole, setBulkRole] = useState<AppRole>('operations');
  const [bulkPermKey, setBulkPermKey] = useState<PermissionKey>('page_dashboard');
  const [bulkSearch, setBulkSearch] = useState('');

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    const { data } = await supabase.from('profiles').select('*').order('full_name');
    setProfiles((data as Profile[]) || []);
    setLoading(false);
  };

  const loadUserPermissions = async (userId: string) => {
    const user = profiles.find(p => p.id === userId);
    if (!user) return;
    setOriginalRole(user.role);
    setEditRole(user.role);

    const { data } = await supabase
      .from('user_permissions')
      .select('permission_key, granted')
      .eq('user_id', userId);

    const overrides: Record<string, boolean> = {};
    if (data) {
      for (const row of data) overrides[row.permission_key] = row.granted;
    }
    setUserOverrides(overrides);

    const resolved: Record<PermissionKey, boolean> = {} as any;
    for (const key of ALL_PERMISSION_KEYS) {
      resolved[key] = key in overrides
        ? overrides[key]
        : (DEFAULT_ROLE_PERMISSIONS[user.role]?.[key] ?? false);
    }
    setEditPerms(resolved);
  };

  useEffect(() => {
    if (selectedUserId) loadUserPermissions(selectedUserId);
  }, [selectedUserId, profiles]);

  const isOverridden = (key: PermissionKey) => {
    const defaultVal = DEFAULT_ROLE_PERMISSIONS[editRole]?.[key] ?? false;
    return editPerms[key] !== defaultVal;
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      // Update role if changed
      if (editRole !== originalRole) {
        const { error } = await supabase
          .from('profiles')
          .update({ role: editRole })
          .eq('id', selectedUserId);
        if (error) throw error;
      }

      // Delete all existing overrides for this user
      await supabase.from('user_permissions').delete().eq('user_id', selectedUserId);

      // Insert only overrides (permissions that differ from role default)
      const inserts: { user_id: string; permission_key: string; granted: boolean }[] = [];
      for (const key of ALL_PERMISSION_KEYS) {
        const defaultVal = DEFAULT_ROLE_PERMISSIONS[editRole]?.[key] ?? false;
        if (editPerms[key] !== defaultVal) {
          inserts.push({ user_id: selectedUserId, permission_key: key, granted: editPerms[key] });
        }
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from('user_permissions').insert(inserts);
        if (error) throw error;
      }

      toast.success('Permissions mises à jour');
      loadProfiles();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    try {
      await supabase.from('user_permissions').delete().eq('user_id', selectedUserId);
      toast.success('Permissions réinitialisées');
      loadUserPermissions(selectedUserId);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  // When role changes, recalculate perms keeping only actual overrides
  const handleRoleChange = (newRole: AppRole) => {
    setEditRole(newRole);
    const resolved: Record<PermissionKey, boolean> = {} as any;
    for (const key of ALL_PERMISSION_KEYS) {
      if (key in userOverrides) {
        resolved[key] = userOverrides[key];
      } else {
        resolved[key] = DEFAULT_ROLE_PERMISSIONS[newRole]?.[key] ?? false;
      }
    }
    setEditPerms(resolved);
  };

  // Bulk actions
  const handleBulkRoleChange = async () => {
    if (selectedUserIds.size === 0) return;
    setSaving(true);
    try {
      for (const uid of selectedUserIds) {
        await supabase.from('profiles').update({ role: bulkRole }).eq('id', uid);
      }
      toast.success(`Rôle mis à jour pour ${selectedUserIds.size} utilisateur(s)`);
      loadProfiles();
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkPermission = async (grant: boolean) => {
    if (selectedUserIds.size === 0) return;
    setSaving(true);
    try {
      for (const uid of selectedUserIds) {
        await supabase.from('user_permissions').upsert(
          { user_id: uid, permission_key: bulkPermKey, granted: grant },
          { onConflict: 'user_id,permission_key' }
        );
      }
      toast.success(`Permission ${grant ? 'accordée' : 'révoquée'} pour ${selectedUserIds.size} utilisateur(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkReset = async () => {
    if (selectedUserIds.size === 0) return;
    setSaving(true);
    try {
      for (const uid of selectedUserIds) {
        await supabase.from('user_permissions').delete().eq('user_id', uid);
      }
      toast.success(`Permissions réinitialisées pour ${selectedUserIds.size} utilisateur(s)`);
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const toggleBulkUser = (id: string) => {
    setSelectedUserIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredProfiles = useMemo(() => {
    const q = userSearch.toLowerCase();
    return profiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, userSearch]);

  const bulkFilteredProfiles = useMemo(() => {
    const q = bulkSearch.toLowerCase();
    return profiles.filter(p =>
      (p.full_name || '').toLowerCase().includes(q) ||
      (p.email || '').toLowerCase().includes(q)
    );
  }, [profiles, bulkSearch]);

  const renderPermTable = (keys: PermissionKey[], title: string) => (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-muted-foreground">{title}</h4>
      <div className="space-y-1">
        {keys.map(key => (
          <div key={key} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
            <div className="flex items-center gap-2">
              <Label className="text-sm">{PERMISSION_LABELS[key]}</Label>
              {isOverridden(key) && (
                <Badge variant="outline" className="text-xs">Personnalisé</Badge>
              )}
            </div>
            <Switch
              checked={editPerms[key] ?? false}
              onCheckedChange={(v) => setEditPerms(prev => ({ ...prev, [key]: v }))}
            />
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) return <div className="text-muted-foreground">Chargement...</div>;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Gestion des permissions</h2>

      <Tabs defaultValue="individual">
        <TabsList>
          <TabsTrigger value="individual">Individuel</TabsTrigger>
          <TabsTrigger value="bulk">En masse</TabsTrigger>
        </TabsList>

        {/* Individual */}
        <TabsContent value="individual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sélectionner un utilisateur</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher un utilisateur..."
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {filteredProfiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email} — {ROLE_LABELS[p.role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {selectedUserId && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rôle</CardTitle>
                </CardHeader>
                <CardContent>
                  <Select value={editRole} onValueChange={(v) => handleRoleChange(v as AppRole)}>
                    <SelectTrigger className="w-60">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Permissions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {renderPermTable(PAGE_PERMISSIONS, 'Pages')}
                  {renderPermTable(ACTION_PERMISSIONS, 'Actions')}
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="w-4 h-4 mr-1" />
                  Appliquer les modifications
                </Button>
                <Button variant="outline" onClick={handleReset} disabled={saving}>
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Réinitialiser aux permissions du rôle
                </Button>
              </div>
            </>
          )}
        </TabsContent>

        {/* Bulk */}
        <TabsContent value="bulk" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UsersIcon className="w-5 h-5" />
                Sélection d'utilisateurs ({selectedUserIds.size})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrer..."
                  value={bulkSearch}
                  onChange={e => setBulkSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="max-h-64 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Rôle</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bulkFilteredProfiles.map(p => (
                      <TableRow key={p.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedUserIds.has(p.id)}
                            onCheckedChange={() => toggleBulkUser(p.id)}
                          />
                        </TableCell>
                        <TableCell>{p.full_name || p.email}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{ROLE_LABELS[p.role]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Actions en masse</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Change role */}
              <div className="flex items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-sm">Changer le rôle</Label>
                  <Select value={bulkRole} onValueChange={v => setBulkRole(v as AppRole)}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleBulkRoleChange} disabled={saving || selectedUserIds.size === 0} size="sm">
                  Appliquer ({selectedUserIds.size})
                </Button>
              </div>

              {/* Grant/revoke permission */}
              <div className="flex items-end gap-3 flex-wrap">
                <div className="space-y-1">
                  <Label className="text-sm">Permission</Label>
                  <Select value={bulkPermKey} onValueChange={v => setBulkPermKey(v as PermissionKey)}>
                    <SelectTrigger className="w-56">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_PERMISSION_KEYS.map(k => (
                        <SelectItem key={k} value={k}>{PERMISSION_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => handleBulkPermission(true)} disabled={saving || selectedUserIds.size === 0} size="sm">
                  Accorder ({selectedUserIds.size})
                </Button>
                <Button onClick={() => handleBulkPermission(false)} disabled={saving || selectedUserIds.size === 0} size="sm" variant="destructive">
                  Révoquer ({selectedUserIds.size})
                </Button>
              </div>

              {/* Reset all */}
              <div>
                <Button variant="outline" onClick={handleBulkReset} disabled={saving || selectedUserIds.size === 0} size="sm">
                  <RotateCcw className="w-4 h-4 mr-1" />
                  Réinitialiser les permissions ({selectedUserIds.size})
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Permissions;
