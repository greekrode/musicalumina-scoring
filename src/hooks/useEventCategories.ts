import { supabase } from '../lib/supabase';
import { CategorySubcategory } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

export function useEventCategories(eventId?: string) {
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
          });
        });
      });

      return result;
    },
    [eventId],
    []
  );

  return { categories, loading: isLoading, error, refetch };
}
