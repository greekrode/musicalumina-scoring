import { supabase } from '../lib/supabase';
import { CategorySubcategory, Registration } from '../types';
import { ParticipantWithScores } from '../types/results';
import { useSupabaseQuery } from './useSupabaseQuery';

interface UseParticipantScoresOptions {
  participants: Registration[];
  categories: CategorySubcategory[];
  selectedEventId: string;
  selectedCategoryCombo: string;
  categoryId: string;
  subcategoryId: string;
}

export function useParticipantScores({
  participants,
  categories,
  selectedEventId,
  selectedCategoryCombo,
  categoryId,
  subcategoryId,
}: UseParticipantScoresOptions) {
  const enabled = !!selectedCategoryCombo;

  return useSupabaseQuery<ParticipantWithScores[]>(
    async () => {
      let participantsToProcess = participants;

      // If "all categories" is selected, fetch participants from all categories in the event
      if (selectedCategoryCombo === 'all' && selectedEventId) {
        const { data: allParticipants, error: participantsError } = await supabase
          .from('registrations')
          .select('*')
          .eq('event_id', selectedEventId)
          .order('created_at', { ascending: true });

        if (participantsError) throw participantsError;
        participantsToProcess = allParticipants || [];
      }

      if (participantsToProcess.length === 0) return [];

      // Batch fetch all scoring data in ONE query
      const participantIds = participantsToProcess.map((p) => p.id);
      const { data: allScoringData, error: scoringError } = await supabase
        .from('event_scoring')
        .select('id, registration_id, jury_id, jury_name, final_score, finalized')
        .in('registration_id', participantIds);

      if (scoringError) throw scoringError;

      // Build scoring map
      const scoringMap = new Map<
        string,
        Array<{
          id: string;
          jury_id: string;
          jury_name: string;
          final_score: number;
          finalized: boolean;
        }>
      >();

      allScoringData?.forEach((scoring) => {
        if (!scoringMap.has(scoring.registration_id)) {
          scoringMap.set(scoring.registration_id, []);
        }
        scoringMap.get(scoring.registration_id)!.push({
          id: scoring.id,
          jury_id: scoring.jury_id,
          jury_name: scoring.jury_name || 'Unknown Jury',
          final_score: scoring.final_score,
          finalized: scoring.finalized,
        });
      });

      // Process participants with their mapped scoring data
      const results: ParticipantWithScores[] = participantsToProcess.map(
        (participant, index) => {
          const participantScoring = scoringMap.get(participant.id) || [];

          const juryScores: Array<{
            id: string;
            juryId: string;
            name: string;
            score: number;
          }> = [];
          let totalScore = 0;
          let scoreCount = 0;
          let isFinalized = false;

          participantScoring.forEach((scoring) => {
            if (scoring.final_score !== null && scoring.final_score !== undefined) {
              juryScores.push({
                id: scoring.id,
                juryId: scoring.jury_id,
                name: scoring.jury_name,
                score: scoring.final_score,
              });
              totalScore += scoring.final_score;
              scoreCount++;
            }
            if (scoring.finalized) isFinalized = true;
          });

          const finalScore = scoreCount > 0 ? totalScore / scoreCount : 0;

          // Find the category display name
          let categoryDisplayName = 'Unknown Category';
          if (selectedCategoryCombo === 'all') {
            const participantCategory = categories.find(
              (c) =>
                c.categoryId === participant.category_id &&
                c.subcategoryId === participant.subcategory_id
            );
            categoryDisplayName = participantCategory?.displayName || 'Unknown Category';
          } else {
            const selectedCategory = categories.find(
              (c) => c.categoryId === categoryId && c.subcategoryId === subcategoryId
            );
            categoryDisplayName = selectedCategory?.displayName || 'Unknown Category';
          }

          return {
            id: participant.id,
            number: index + 1,
            fullName: participant.participant_name,
            averageScore: finalScore,
            scoreCount,
            category: categoryDisplayName,
            piece: participant.song_title || 'Not specified',
            duration: participant.song_duration || 'Not specified',
            aspectScores: {},
            isFinalized,
            juryScores,
          };
        }
      );

      // Sort by score (highest first)
      results.sort((a, b) => b.averageScore - a.averageScore);
      return results;
    },
    [participants, selectedCategoryCombo, selectedEventId, categories, categoryId, subcategoryId],
    [],
    { enabled }
  );
}
