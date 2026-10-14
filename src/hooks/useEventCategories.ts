import { supabase } from '../lib/supabase';
import { CategorySubcategory } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

export function useEventCategories(eventId?: string, cacheKey?: string) {
  const { data: categories, isLoading, error, refetch } = useSupabaseQuery<CategorySubcategory[]>(
    async () => {
      let eventIds: string[] = [];

      if (eventId) {
        eventIds = [eventId];
      } else {
        const { data: activeEvents, error: eventsError } = await supabase
          .from('events')
          .select('id')
          .eq('active', true);

        if (eventsError) throw eventsError;
        if (!activeEvents || activeEvents.length === 0) return [];

        eventIds = activeEvents.map((e) => e.id);
      }

      const { data: categoriesData, error: categoriesError } = await supabase
        .from('event_categories')
        .select(`
          id,
          name,
          event_id,
          event_subcategories!inner (
            id,
            name,
            age_requirement,
            order_index
          )
        `)
        .in('event_id', eventIds)
        .order('order_index', { ascending: true });

      if (categoriesError) throw categoriesError;

      // Published running order; categories follow it, unscheduled ones go last.
      const { data: segments, error: segmentsError } = await supabase
        .from('festival_schedule_segments')
        .select('subcategory_id, session_number, starts_at')
        .in('event_id', eventIds)
        .eq('kind', 'performance');
      if (segmentsError) throw segmentsError;
      const slots = new Map<string, { session_number: number | null; starts_at: string }>();
      segments?.forEach((s) => {
        const prev = slots.get(s.subcategory_id);
        if (!prev || s.starts_at < prev.starts_at) slots.set(s.subcategory_id, s);
      });

      const result: CategorySubcategory[] = [];

      categoriesData?.forEach((category) => {
        const subcategories = category.event_subcategories as Array<{
          id: string;
          name: string;
          age_requirement: string;
          order_index: number;
        }>;
        const sorted = [...subcategories].sort((a, b) => a.order_index - b.order_index);

        sorted.forEach((subcategory) => {
          result.push({
            categoryId: category.id,
            subcategoryId: subcategory.id,
            categoryName: category.name,
            subcategoryName: subcategory.name,
            ageRequirement: subcategory.age_requirement,
            displayName: `${category.name} - ${subcategory.name} (${subcategory.age_requirement})`,
            eventId: category.event_id || '',
            sessionNumber: slots.get(subcategory.id)?.session_number ?? null,
            startsAt: slots.get(subcategory.id)?.starts_at ?? null,
          });
        });
      });

      // Stable sort keeps the category order for unscheduled entries.
      return result.sort(
        (a, b) =>
          (a.startsAt ? Date.parse(a.startsAt) : Number.MAX_SAFE_INTEGER) -
          (b.startsAt ? Date.parse(b.startsAt) : Number.MAX_SAFE_INTEGER)
      );
    },
    [eventId],
    [],
    { cacheKey }
  );

  return { categories, loading: isLoading, error, refetch };
}
