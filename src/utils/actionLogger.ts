import { supabase } from '@/integrations/supabase/client';

let cachedUserId: string | null = null;

const getUserId = async (): Promise<string | null> => {
  if (cachedUserId) return cachedUserId;
  const { data: { user } } = await supabase.auth.getUser();
  cachedUserId = user?.id || null;
  return cachedUserId;
};

// Reset cache on auth state change
supabase.auth.onAuthStateChange(() => {
  cachedUserId = null;
});

export const logUserAction = async (action: {
  action_type: string;
  warehouse_id: string;
  parcel_id?: string;
  action_data?: Record<string, unknown>;
}) => {
  const userId = await getUserId();
  if (!userId) return;

  // Fire and forget - don't block the UI
  supabase
    .from('user_actions' as any)
    .insert({
      user_id: userId,
      warehouse_id: action.warehouse_id,
      action_type: action.action_type,
      parcel_id: action.parcel_id || null,
      action_data: action.action_data || null,
    })
    .then(({ error }) => {
      if (error) console.warn('Action log error:', error);
    });
};
