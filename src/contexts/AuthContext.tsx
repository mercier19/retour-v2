import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Profile, Warehouse } from '@/types/database';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  warehouses: Warehouse[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = async (userId: string) => {
    // Load profile
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileData) {
      setProfile(profileData as Profile);

      // Load warehouses based on role
      if (profileData.role === 'super_admin') {
        const { data: allWarehouses } = await supabase
          .from('warehouses')
          .select('*')
          .order('name');
        setWarehouses((allWarehouses as Warehouse[]) || []);
      } else {
        const { data: userWarehouses } = await supabase
          .from('user_warehouses')
          .select('warehouse_id')
          .eq('user_id', userId);

        if (userWarehouses && userWarehouses.length > 0) {
          const warehouseIds = userWarehouses.map((uw) => uw.warehouse_id);
          const { data: warehouseData } = await supabase
            .from('warehouses')
            .select('*')
            .in('id', warehouseIds)
            .order('name');
          setWarehouses((warehouseData as Warehouse[]) || []);
        } else {
          setWarehouses([]);
        }
      }
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => loadUserData(session.user.id), 0);
        } else {
          setProfile(null);
          setWarehouses([]);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setWarehouses([]);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, warehouses, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
