import { useMemo } from 'react';
import { PrizeConfiguration, ParticipantWithPrize, PrizeAssignment } from '../types';
import { ParticipantWithScores } from '../types/results';
import { calculatePrizeAssignments } from '../utils/calculatePrizeAssignments';

interface UsePrizeAssignmentCalculationResult {
  prizeAssignments: PrizeAssignment[];
  assignedParticipants: ParticipantWithPrize[];
}

export function usePrizeAssignmentCalculation(
  participantsWithScores: ParticipantWithScores[],
  prizeConfigurations: PrizeConfiguration[]
): UsePrizeAssignmentCalculationResult {
  return useMemo(() => {
    if (!participantsWithScores.length) {
      return { prizeAssignments: [], assignedParticipants: [] };
    }

    return calculatePrizeAssignments(participantsWithScores, prizeConfigurations);
  }, [participantsWithScores, prizeConfigurations]);
}
