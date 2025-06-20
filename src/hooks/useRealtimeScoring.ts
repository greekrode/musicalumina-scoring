import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel, REALTIME_LISTEN_TYPES } from '@supabase/supabase-js';

interface UseRealtimeScoringProps {
  eventId?: string;
  categoryId?: string;
  subcategoryId?: string;
  onScoringChange: () => void;
  onHistoryChange?: () => void;
  enabled?: boolean;
}

export interface RealtimeStatus {
  connected: boolean;
  error?: string;
  lastError?: string;
}

export function useRealtimeScoring({
  eventId,
  categoryId,
  subcategoryId,
  onScoringChange,
  onHistoryChange,
  enabled = true
}: UseRealtimeScoringProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyChannelRef = useRef<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>({ connected: false });
  
  // Use refs to store stable references to callbacks
  const onScoringChangeRef = useRef(onScoringChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  // Update refs when callbacks change
  useEffect(() => {
    onScoringChangeRef.current = onScoringChange;
  }, [onScoringChange]);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  useEffect(() => {
    if (!enabled) {
      cleanup();
      return;
    }

    // Clean up existing subscriptions
    cleanup();

    // Subscribe to event_scoring changes
    if (eventId) {
      const scoringChannel = supabase
        .channel(`scoring-${eventId}-${categoryId || 'all'}-${subcategoryId || 'all'}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_scoring',
            filter: categoryId && subcategoryId 
              ? `category_id=eq.${categoryId}` 
              : undefined
          },
          (payload) => {
            // Additional filtering for subcategory if needed
            if (subcategoryId && payload.new && 'subcategory_id' in payload.new) {
              if (payload.new.subcategory_id !== subcategoryId) {
                return; // Skip if not for current subcategory
              }
            }
            
            // Trigger refresh using ref
            onScoringChangeRef.current();
          }
        )
        .subscribe((subscriptionStatus, err) => {
          if (subscriptionStatus === 'SUBSCRIBED') {
            setStatus(prev => ({ ...prev, connected: true, error: undefined }));
          } else if (subscriptionStatus === 'CHANNEL_ERROR') {
            const errorMsg = err?.message || 'Channel subscription error';
            setStatus(prev => ({ ...prev, connected: false, error: errorMsg, lastError: errorMsg }));
          } else if (subscriptionStatus === 'TIMED_OUT') {
            const errorMsg = 'Realtime connection timed out';
            setStatus(prev => ({ ...prev, connected: false, error: errorMsg, lastError: errorMsg }));
          } else if (subscriptionStatus === 'CLOSED') {
            setStatus(prev => ({ ...prev, connected: false }));
          }
        });

      channelRef.current = scoringChannel;

      // Subscribe to scoring history changes if callback provided
      if (onHistoryChangeRef.current) {
        const historyChannel = supabase
          .channel(`history-${eventId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'event_scoring_history',
              filter: `event_id=eq.${eventId}`
            },
            (payload) => {
              // Additional filtering for category if needed
              if (categoryId && subcategoryId && payload.new && 'category_id' in payload.new) {
                if (payload.new.category_id !== categoryId || payload.new.subcategory_id !== subcategoryId) {
                  return; // Skip if not for current category
                }
              }
              
              onHistoryChangeRef.current?.();
            }
          )
          .subscribe((subscriptionStatus, err) => {
            if (subscriptionStatus === 'CHANNEL_ERROR') {
              console.error('❌ History realtime subscription error:', err);
            } else if (subscriptionStatus === 'TIMED_OUT') {
              console.error('⏰ History realtime subscription timed out');
            }
          });

        historyChannelRef.current = historyChannel;
      }
    }

    return cleanup;
  }, [eventId, categoryId, subcategoryId, enabled]); // Removed callbacks from dependency array

  const cleanup = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (historyChannelRef.current) {
      supabase.removeChannel(historyChannelRef.current);
      historyChannelRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, []);

  return { cleanup, status };
} 