import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ParticipantWithPrize } from '../types';

interface FinalizeScoresArgs {
  eventId?: string;
  categoryId?: string;
  subcategoryId?: string;
  winners: ParticipantWithPrize[];
}

interface UseFinalizeScoresResult {
  finalizeScores: (args: FinalizeScoresArgs) => Promise<void>;
  finalizing: boolean;
  error: string | null;
}

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function useFinalizeScores(): UseFinalizeScoresResult {
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const finalizeScores = useCallback(
    async ({ eventId, categoryId, subcategoryId, winners }: FinalizeScoresArgs) => {
      if (!eventId || !categoryId || !subcategoryId) {
        throw new Error('Missing identifiers required to finalize scores.');
      }

      setFinalizing(true);
      setError(null);

      try {
        const winnersToInsert = winners
          .filter((winner) => !!winner.prizeLevel)
          .map((winner) => ({
            participant_name: toTitleCase(winner.participant_name),
            prize_title: winner.prizeLevel!,
          }));

        // One transaction: locks the scores and replaces the winners (admin or score_staff).
        const { data, error: finalizeError } = await supabase.rpc('finalize_scores', {
          p_event_id: eventId,
          p_category_id: categoryId,
          p_subcategory_id: subcategoryId,
          p_winners: winnersToInsert,
        });
        if (finalizeError) throw finalizeError;
        const code = (data as { error?: string } | null)?.error;
        if (code) {
          throw new Error(code === 'forbidden' ? 'You do not have permission to finalize scores.' : `Finalize failed (${code}).`);
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to finalize scores.';
        setError(message);
        throw err;
      } finally {
        setFinalizing(false);
      }
    },
    []
  );

  return { finalizeScores, finalizing, error };
}
