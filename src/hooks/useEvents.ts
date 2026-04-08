import { supabase } from '../lib/supabase';
import { Event } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

interface UseEventsOptions {
  includeInactive?: boolean;
}

export function useEvents(options?: UseEventsOptions) {
  const includeInactive = options?.includeInactive ?? false;

  const { data: events, isLoading, error, refetch } = useSupabaseQuery<Event[]>(
    async () => {
      let query = supabase
        .from('events')
        .select('*')
        .in('type', ['competition', 'festival'])
        .order('start_date', { ascending: false });

      if (!includeInactive) {
        query = query.eq('active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    [includeInactive],
    []
  );

  return { events, loading: isLoading, error, refetch };
}
