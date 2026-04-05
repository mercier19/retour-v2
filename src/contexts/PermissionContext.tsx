import React, { createContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { AppRole } from '@/types/database';
import { PermissionKey } from '@/hooks/usePermission';

interface PermissionContextType {
  role: AppRole | null;
  overrides: Partial<Record<PermissionKey, boolean>>;
  loading: boolean;
  refetch: () => Promise<void>;
}

export const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile } = useAuth();
  const [overrides, setOverrides] = useState<Partial<Record<PermissionKey, boolean>>>({});
  const [loading, setLoading] = useState(true);

  const fetchOverrides = async () => {
    if (!user) {
      setOverrides({});
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_permissions')
      .select('permission_key, granted')
      .eq('user_id', user.id);

    const map: Partial<Record<PermissionKey, boolean>> = {};
    if (data) {
      for (const row of data) {
        map[row.permission_key as PermissionKey] = row.granted;
      }
    }
    setOverrides(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchOverrides();
  }, [user?.id]);

  return (
    <PermissionContext.Provider value={{
      role: profile?.role ?? null,
      overrides,
      loading,
      refetch: fetchOverrides,
    }}>
      {children}
    </PermissionContext.Provider>
  );
};
