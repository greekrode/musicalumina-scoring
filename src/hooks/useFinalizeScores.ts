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
        const { error: finalizeError } = await supabase
          .from('event_scoring')
          .update({ finalized: true })
          .eq('category_id', categoryId)
          .eq('subcategory_id', subcategoryId);

        if (finalizeError) throw finalizeError;

        const winnersToInsert = winners
          .filter((winner) => !!winner.prizeLevel)
          .map((winner) => ({
            event_id: eventId,
            category_id: categoryId,
            subcategory_id: subcategoryId,
            participant_name: toTitleCase(winner.participant_name),
            prize_title: winner.prizeLevel!,
          }));

        if (winnersToInsert.length > 0) {
          await supabase
            .from('event_winners')
            .delete()
            .eq('event_id', eventId)
            .eq('category_id', categoryId)
            .eq('subcategory_id', subcategoryId);

          const { error: insertError } = await supabase
            .from('event_winners')
            .insert(winnersToInsert);

          if (insertError) throw insertError;
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
