import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PrizeConfiguration } from '../types';
import { useSupabaseQuery } from './useSupabaseQuery';

export function usePrizeConfigurations(
  eventId?: string,
  categoryId?: string,
  subcategoryId?: string
) {
  const enabled = !!eventId && !!categoryId && !!subcategoryId;

  const {
    data: prizeConfigurations,
    isLoading,
    error,
    refetch,
  } = useSupabaseQuery<PrizeConfiguration[]>(
    async () => {
      const { data, error } = await supabase
        .from('event_prize_configurations')
        .select('*')
        .eq('event_id', eventId!)
        .eq('category_id', categoryId!)
        .eq('subcategory_id', subcategoryId!)
        .eq('active', true)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
    [eventId, categoryId, subcategoryId],
    [],
    { enabled }
  );

  const createPrizeConfiguration = useCallback(
    async (prizeConfig: Omit<PrizeConfiguration, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('event_prize_configurations')
        .insert(prizeConfig)
        .select()
        .single();

      if (error) throw error;
      refetch();
      return data;
    },
    [refetch]
  );

  const updatePrizeConfiguration = useCallback(
    async (id: string, updates: Partial<PrizeConfiguration>) => {
      const { data, error } = await supabase
        .from('event_prize_configurations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      refetch();
      return data;
    },
    [refetch]
  );

  const deletePrizeConfiguration = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from('event_prize_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      refetch();
    },
    [refetch]
  );

  return {
    prizeConfigurations,
    loading: isLoading,
    error,
    createPrizeConfiguration,
    updatePrizeConfiguration,
    deletePrizeConfiguration,
    refetch,
  };
}
