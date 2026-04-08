import { supabase } from '../lib/supabase';
import { EventScoringAspect } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

export function useScoringAspects(eventId?: string) {
  const { data: aspects, isLoading, error, refetch } = useSupabaseQuery<EventScoringAspect[]>(
    async () => {
      const { data, error } = await supabase
        .from('event_scoring_aspects')
        .select('*')
        .eq('event_id', eventId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    [eventId],
    [],
    { enabled: !!eventId }
  );

  return { aspects, loading: isLoading, error, refetch };
}
