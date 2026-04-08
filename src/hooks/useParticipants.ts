import { supabase } from '../lib/supabase';
import { Registration } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

export function useParticipants(categoryId?: string, subcategoryId?: string) {
  const { data: participants, isLoading, error, refetch } = useSupabaseQuery<Registration[]>(
    async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select('*')
        .eq('category_id', categoryId!)
        .eq('subcategory_id', subcategoryId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    [categoryId, subcategoryId],
    [],
    { enabled: !!categoryId && !!subcategoryId }
  );

  return { participants, loading: isLoading, error, refetch };
}
