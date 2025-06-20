import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { EventScoringAspect } from '../types';

export function useScoringAspects(eventId?: string) {
  const [aspects, setAspects] = useState<EventScoringAspect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (eventId) {
      fetchAspects();
    } else {
      setAspects([]);
      setLoading(false);
    }
  }, [eventId]);

  const fetchAspects = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('event_scoring_aspects')
        .select('*')
        .eq('event_id', eventId)
        .order('order_index', { ascending: true });

      if (fetchError) throw fetchError;

      setAspects(data || []);
    } catch (err) {
      console.error('Error fetching scoring aspects:', err);
      setError('Failed to fetch scoring aspects');
    } finally {
      setLoading(false);
    }
  };

  return { aspects, loading, error, refetch: fetchAspects };
} 