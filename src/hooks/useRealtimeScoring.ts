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

const MAX_RETRY_DELAY = 30_000;
const INITIAL_RETRY_DELAY = 1_000;

export function useRealtimeScoring({
  eventId,
  categoryId,
  subcategoryId,
  onScoringChange,
  onHistoryChange,
  enabled = true,
  refreshKey = 0,
}: UseRealtimeScoringProps) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const historyChannelRef = useRef<RealtimeChannel | null>(null);
  const [status, setStatus] = useState<RealtimeStatus>({ connected: false });
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const isMountedRef = useRef(true);

  // Stable callback refs — avoids re-subscribing when callbacks change
  const onScoringChangeRef = useRef(onScoringChange);
  const onHistoryChangeRef = useRef(onHistoryChange);

  useEffect(() => {
    onScoringChangeRef.current = onScoringChange;
  }, [onScoringChange]);

  useEffect(() => {
    onHistoryChangeRef.current = onHistoryChange;
  }, [onHistoryChange]);

  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  const removeChannels = useCallback(async () => {
    const channels = [channelRef.current, historyChannelRef.current].filter(
      Boolean
    ) as RealtimeChannel[];
    channelRef.current = null;
    historyChannelRef.current = null;

    await Promise.allSettled(
      channels.map((ch) => supabase.removeChannel(ch))
    );
  }, []);

  const cleanup = useCallback(async () => {
    clearRetryTimeout();
    await removeChannels();
  }, [clearRetryTimeout, removeChannels]);

  const setupChannels = useCallback(async () => {
    if (!isMountedRef.current || !enabled || !eventId) return;

    // Clean previous channels before setting up new ones
    await removeChannels();

    const channelName = `scoring-${eventId}-${categoryId || 'all'}-${subcategoryId || 'all'}`;

    const scoringChannel = supabase
      .channel(channelName)
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
          if (
            subcategoryId &&
            payload.new &&
            'subcategory_id' in payload.new
          ) {
            if (payload.new.subcategory_id !== subcategoryId) return;
          }
          onScoringChangeRef.current();
        }
      )
      .subscribe((subscriptionStatus, err) => {
        if (!isMountedRef.current) return;

        if (subscriptionStatus === 'SUBSCRIBED') {
          retryCountRef.current = 0;
          setStatus({ connected: true, error: undefined });
        } else if (
          subscriptionStatus === 'CHANNEL_ERROR' ||
          subscriptionStatus === 'TIMED_OUT'
        ) {
          const errorMsg =
            subscriptionStatus === 'TIMED_OUT'
              ? 'Realtime connection timed out'
              : err?.message || 'Channel subscription error';
          setStatus({ connected: false, error: errorMsg, lastError: errorMsg });
          scheduleRetry();
        } else if (subscriptionStatus === 'CLOSED') {
          setStatus({ connected: false });
        }
      });

    channelRef.current = scoringChannel;

    // History channel — only if consumer needs it
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
            console.error('History realtime subscription error:', err);
          } else if (subscriptionStatus === 'TIMED_OUT') {
            console.error('History realtime subscription timed out');
          }
        });

      historyChannelRef.current = historyChannel;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, categoryId, subcategoryId, enabled, removeChannels]);

  const scheduleRetry = useCallback(() => {
    if (!isMountedRef.current) return;
    clearRetryTimeout();

    const delay = Math.min(
      INITIAL_RETRY_DELAY * 2 ** retryCountRef.current,
      MAX_RETRY_DELAY
    );
    retryCountRef.current += 1;

    retryTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setupChannels();
      }
    }, delay);
  }, [clearRetryTimeout, setupChannels]);

  // Reconnect on tab visibility change — browsers kill WebSockets when backgrounded
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && eventId) {
        // Small delay to let network stack recover
        setTimeout(() => {
          if (!isMountedRef.current) return;
          // Check if we're actually disconnected before reconnecting
          const channel = channelRef.current;
          if (!channel || channel.state !== 'joined') {
            retryCountRef.current = 0;
            setupChannels();
          }
        }, 500);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, eventId, setupChannels]);

  // Mount guard — only tracks component lifecycle, not dep changes
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Main setup/teardown effect
  useEffect(() => {
    if (!enabled || !eventId) {
      cleanup();
      setStatus({ connected: false });
      return;
    }

    setupChannels();

    return () => {
      cleanup();
    };
  }, [eventId, categoryId, subcategoryId, enabled, refreshKey, setupChannels, cleanup]);

  return { cleanup, status };
}
