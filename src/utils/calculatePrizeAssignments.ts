import { ParticipantWithPrize, PrizeAssignment, PrizeConfiguration } from '../types';
import { ParticipantWithScores } from '../types/results';

const mapParticipantsToPrizeFormat = (
  participants: ParticipantWithScores[]
): ParticipantWithPrize[] =>
  participants
    .map((participant) => ({
      id: participant.id,
      participant_name: participant.fullName,
      averageScore: participant.averageScore,
      scoreCount: participant.scoreCount,
      piece: participant.piece,
      duration: participant.duration,
      juryScores: participant.juryScores,
      isFinalized: participant.isFinalized,
    }))
    .sort((a, b) => b.averageScore - a.averageScore);

export interface PrizeCalculationResult {
  prizeAssignments: PrizeAssignment[];
  assignedParticipants: ParticipantWithPrize[];
}

export const calculatePrizeAssignments = (
  participantsWithScores: ParticipantWithScores[],
  prizeConfigurations: PrizeConfiguration[]
): PrizeCalculationResult => {
  if (!participantsWithScores.length) {
    return { prizeAssignments: [], assignedParticipants: [] };
  }

  const baseParticipants = mapParticipantsToPrizeFormat(participantsWithScores);

  if (!prizeConfigurations.length) {
    return { prizeAssignments: [], assignedParticipants: baseParticipants };
  }

  const eligibleParticipants = baseParticipants.filter((participant) => participant.scoreCount > 0);
  const participantsWithoutScores = baseParticipants.filter((participant) => participant.scoreCount === 0);

  if (!eligibleParticipants.length) {
    return {
      prizeAssignments: [],
      assignedParticipants: [...participantsWithoutScores],
    };
  }

  const sortedPrizes = [...prizeConfigurations].sort(
    (a, b) => a.display_order - b.display_order
  );

  const assignments: PrizeAssignment[] = [];
  const assignedParticipantsList: ParticipantWithPrize[] = [];
  const remainingParticipants = [...eligibleParticipants];

  for (const prizeConfig of sortedPrizes) {
    const prizeAssignment: PrizeAssignment = {
      prizeLevel: prizeConfig.prize_level,
      displayOrder: prizeConfig.display_order,
      maxWinners: prizeConfig.max_winners,
      winners: [],
      scoreRange: {
        min: prizeConfig.min_score || 0,
        max: prizeConfig.max_score || 100,
      },
    };

    const eligibleForThisPrize = remainingParticipants.filter((participant) =>
      prizeConfig.min_score === null || participant.averageScore >= prizeConfig.min_score
    );

    if (!eligibleForThisPrize.length) {
      assignments.push(prizeAssignment);
      continue;
    }

    const scoreGroups = new Map<number, ParticipantWithPrize[]>();
    eligibleForThisPrize.forEach((participant) => {
      const score = participant.averageScore;
      if (!scoreGroups.has(score)) {
        scoreGroups.set(score, []);
      }
      scoreGroups.get(score)!.push(participant);
    });

    const sortedScores = Array.from(scoreGroups.keys()).sort((a, b) => b - a);
    let winnersAssigned = 0;

    for (const score of sortedScores) {
      const participantsWithThisScore = scoreGroups.get(score)!;

      if (winnersAssigned + participantsWithThisScore.length > prizeConfig.max_winners) {
        if (winnersAssigned === 0) {
          participantsWithThisScore.forEach((participant) => {
            participant.prizeLevel = prizeConfig.prize_level;
            participant.prizeDisplayOrder = prizeConfig.display_order;
            prizeAssignment.winners.push(participant);
            assignedParticipantsList.push(participant);
          });
          participantsWithThisScore.forEach((participant) => {
            const index = remainingParticipants.findIndex((p) => p.id === participant.id);
            if (index > -1) remainingParticipants.splice(index, 1);
          });
          break;
        }
        break;
      } else {
        participantsWithThisScore.forEach((participant) => {
          participant.prizeLevel = prizeConfig.prize_level;
          participant.prizeDisplayOrder = prizeConfig.display_order;
          prizeAssignment.winners.push(participant);
          assignedParticipantsList.push(participant);
        });
        winnersAssigned += participantsWithThisScore.length;

        participantsWithThisScore.forEach((participant) => {
          const index = remainingParticipants.findIndex((p) => p.id === participant.id);
          if (index > -1) remainingParticipants.splice(index, 1);
        });

        if (winnersAssigned >= prizeConfig.max_winners) {
          break;
        }
      }
    }

    assignments.push(prizeAssignment);
  }

  remainingParticipants.forEach((participant) => {
    participant.prizeLevel = undefined;
    participant.prizeDisplayOrder = undefined;
    assignedParticipantsList.push(participant);
  });

  participantsWithoutScores.forEach((participant) => {
    participant.prizeLevel = undefined;
    participant.prizeDisplayOrder = undefined;
    assignedParticipantsList.push(participant);
  });

  return { prizeAssignments: assignments, assignedParticipants: assignedParticipantsList };
};
