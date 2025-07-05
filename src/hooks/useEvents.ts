import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Event } from '../types';

export function useEvents() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .in('type', ['competition', 'festival'])
        .eq('active', true)
        .order('start_date', { ascending: false });

      if (fetchError) throw fetchError;

      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to fetch events');
    } finally {
      setLoading(false);
    }
  };

  return { events, loading, error, refetch: fetchEvents };
} 