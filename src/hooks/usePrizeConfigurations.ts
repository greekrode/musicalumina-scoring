import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PrizeConfiguration } from '../types';

export function usePrizeConfigurations(eventId?: string, categoryId?: string, subcategoryId?: string) {
  const [prizeConfigurations, setPrizeConfigurations] = useState<PrizeConfiguration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId && categoryId && subcategoryId) {
      fetchPrizeConfigurations();
    } else {
      setPrizeConfigurations([]);
      setLoading(false);
    }
  }, [eventId, categoryId, subcategoryId]);

  const fetchPrizeConfigurations = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('event_prize_configurations')
        .select('*')
        .eq('event_id', eventId)
        .eq('category_id', categoryId)
        .eq('subcategory_id', subcategoryId)
        .eq('active', true)
        .order('display_order', { ascending: true });

      if (fetchError) throw fetchError;

      setPrizeConfigurations(data || []);
    } catch (err) {
      console.error('Error fetching prize configurations:', err);
      setError('Failed to fetch prize configurations');
    } finally {
      setLoading(false);
    }
  };

  const createPrizeConfiguration = async (prizeConfig: Omit<PrizeConfiguration, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('event_prize_configurations')
        .insert(prizeConfig)
        .select()
        .single();

      if (error) throw error;

      setPrizeConfigurations(prev => [...prev, data].sort((a, b) => a.display_order - b.display_order));
      return data;
    } catch (err) {
      console.error('Error creating prize configuration:', err);
      throw err;
    }
  };

  const updatePrizeConfiguration = async (id: string, updates: Partial<PrizeConfiguration>) => {
    try {
      const { data, error } = await supabase
        .from('event_prize_configurations')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      setPrizeConfigurations(prev => 
        prev.map(config => config.id === id ? data : config)
           .sort((a, b) => a.display_order - b.display_order)
      );
      return data;
    } catch (err) {
      console.error('Error updating prize configuration:', err);
      throw err;
    }
  };

  const deletePrizeConfiguration = async (id: string) => {
    try {
      const { error } = await supabase
        .from('event_prize_configurations')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPrizeConfigurations(prev => prev.filter(config => config.id !== id));
    } catch (err) {
      console.error('Error deleting prize configuration:', err);
      throw err;
    }
  };

  return {
    prizeConfigurations,
    loading,
    error,
    createPrizeConfiguration,
    updatePrizeConfiguration,
    deletePrizeConfiguration,
    refetch: fetchPrizeConfigurations
  };
} 