import { supabase } from '../lib/supabase';
import { Registration } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

// What the jury scoresheet shows. Jury lists are kept on the device for
// offline use, so they never include contact, payment or document fields.
const JURY_COLUMNS =
  'id, event_id, category_id, subcategory_id, participant_name, song_title, song_duration, song_pdf_url, video_url, status, created_at';

export function useParticipants(categoryId?: string, subcategoryId?: string, options?: { jury?: boolean }) {
  const jury = options?.jury ?? false;
  const { data: participants, isLoading, error, refetch } = useSupabaseQuery<Registration[]>(
    async () => {
      const { data, error } = await supabase
        .from('registrations')
        .select(jury ? JURY_COLUMNS : '*')
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
