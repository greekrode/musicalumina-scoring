import { supabase } from '../lib/supabase';
import { Registration } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

// scoring_registrations (a view) carries only these columns: no contact,
// payment or document fields, so lists are also safe to keep on jury devices.
const COLUMNS =
  'id, event_id, category_id, subcategory_id, participant_name, song_title, song_duration, song_pdf_url, video_url, status, created_at';

export function useParticipants(categoryId?: string, subcategoryId?: string, options?: { jury?: boolean }) {
  const jury = options?.jury ?? false;
  const { data: participants, isLoading, error, refetch } = useSupabaseQuery<Registration[]>(
    async () => {
      const { data, error } = await supabase
        .from('scoring_registrations')
        .select(COLUMNS)
        .eq('category_id', categoryId!)
        .eq('subcategory_id', subcategoryId!)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as Registration[];
    },
    [categoryId, subcategoryId, jury],
    [],
    {
      enabled: !!categoryId && !!subcategoryId,
      cacheKey: jury && categoryId && subcategoryId ? `participants:${categoryId}|${subcategoryId}` : undefined,
    }
  );

  return { participants, loading: isLoading, error, refetch };
}
