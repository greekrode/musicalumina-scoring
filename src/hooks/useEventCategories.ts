import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CategorySubcategory } from '../types';

export function useEventCategories(eventId?: string) {
  const [categories, setCategories] = useState<CategorySubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [eventId]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);

      // If eventId is provided, use it directly. Otherwise, get all active events
      let eventIds: string[] = [];
      
      if (eventId) {
        eventIds = [eventId];
      } else {
        // Get active events if no specific eventId provided
        const { data: activeEvents, error: eventsError } = await supabase
          .from('events')
          .select('id')
          .eq('active', true);

        if (eventsError) throw eventsError;
        if (!activeEvents || activeEvents.length === 0) {
          setCategories([]);
          return;
        }

        eventIds = activeEvents.map(e => e.id);
      }

      // Fetch categories and subcategories for the specified event(s)
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

      // Transform the data into CategorySubcategory format
      const transformedCategories: CategorySubcategory[] = [];
      
      categoriesData?.forEach(category => {
        const subcategories = category.event_subcategories as any[];
        // Sort subcategories by order_index
        const sortedSubcategories = subcategories?.sort((a, b) => a.order_index - b.order_index) || [];
        
        sortedSubcategories.forEach(subcategory => {
          transformedCategories.push({
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

      setCategories(transformedCategories);
    } catch (err) {
      console.error('Error fetching categories:', err);
      setError('Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  };

  return { categories, loading, error, refetch: fetchCategories };
} 