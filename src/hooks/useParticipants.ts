import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Registration } from '../types';

export function useParticipants(categoryId?: string, subcategoryId?: string) {
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (categoryId && subcategoryId) {
      fetchParticipants();
    } else {
      setParticipants([]);
      setLoading(false);
    }
  }, [categoryId, subcategoryId]);

  const fetchParticipants = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('registrations')
        .select('*')
        .eq('category_id', categoryId)
        .eq('subcategory_id', subcategoryId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setParticipants(data || []);
    } catch (err) {
      console.error('Error fetching participants:', err);
      setError('Failed to fetch participants');
    } finally {
      setLoading(false);
    }
  };

  return { participants, loading, error, refetch: fetchParticipants };
} 