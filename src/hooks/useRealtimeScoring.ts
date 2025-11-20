import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeScoringProps {
  eventId?: string;
  categoryId?: string;
  subcategoryId?: string;
  onScoringChange: () => void;
  onHistoryChange?: () => void;
  enabled?: boolean;
  refreshKey?: number;
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
  enabled = true,
  refreshKey = 0
}: UseRealtimeScoringProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyChannelRef = useRef<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>({ connected: false });
  const currentRefreshKeyRef = useRef(refreshKey);
  
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

  const cleanup = useCallback(async () => {
    if (channelRef.current) {
      try {
        await supabase.removeChannel(channelRef.current);
      } catch (err) {
        console.warn('Failed to remove realtime channel', err);
      }
      channelRef.current = null;
    }
    if (historyChannelRef.current) {
      try {
        await supabase.removeChannel(historyChannelRef.current);
      } catch (err) {
        console.warn('Failed to remove history realtime channel', err);
      }
      historyChannelRef.current = null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const setupRealtime = async () => {
      if (!enabled || !eventId) {
        await cleanup();
        if (isMounted) {
          setStatus({ connected: false });
          currentRefreshKeyRef.current = refreshKey;
        }
        return;
      }

      currentRefreshKeyRef.current = refreshKey;
      setStatus({ connected: false });
      await cleanup();

      const scoringChannel = supabase
        .channel(`scoring-${eventId}-${categoryId || 'all'}-${subcategoryId || 'all'}-${refreshKey}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_scoring',
            filter:
              categoryId && subcategoryId
                ? `category_id=eq.${categoryId}`
                : undefined,
          },
          (payload) => {
            if (subcategoryId && payload.new && 'subcategory_id' in payload.new) {
              if (payload.new.subcategory_id !== subcategoryId) {
                return;
              }
            }

            onScoringChangeRef.current();
          }
        )
        .subscribe((subscriptionStatus, err) => {
          const isCurrentSubscription =
            currentRefreshKeyRef.current === refreshKey;

          if (!isCurrentSubscription) {
            return;
          }

          if (subscriptionStatus === 'SUBSCRIBED') {
            setStatus({ connected: true, error: undefined });
          } else if (subscriptionStatus === 'CHANNEL_ERROR') {
            const errorMsg = err?.message || 'Channel subscription error';
            setStatus({ connected: false, error: errorMsg, lastError: errorMsg });
          } else if (subscriptionStatus === 'TIMED_OUT') {
            const errorMsg = 'Realtime connection timed out';
            setStatus({ connected: false, error: errorMsg, lastError: errorMsg });
          } else if (subscriptionStatus === 'CLOSED') {
            setStatus({ connected: false });
          }
        });

      channelRef.current = scoringChannel;

      if (onHistoryChangeRef.current) {
        const historyChannel = supabase
          .channel(`history-${eventId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'event_scoring_history',
              filter: `event_id=eq.${eventId}`,
            },
            (payload) => {
              if (
                categoryId &&
                subcategoryId &&
                payload.new &&
                'category_id' in payload.new
              ) {
                if (
                  payload.new.category_id !== categoryId ||
                  payload.new.subcategory_id !== subcategoryId
                ) {
                  return;
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
    };

    setupRealtime();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [
    eventId,
    categoryId,
    subcategoryId,
    enabled,
    refreshKey,
    cleanup,
  ]);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return { cleanup, status };
} 
