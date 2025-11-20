export interface ParticipantWithScores {
  id: string;
  number: number;
  fullName: string;
  averageScore: number;
  scoreCount: number;
  category: string;
  piece: string;
  duration: string;
  aspectScores: Record<string, { score: number; weight: number; name: string }>;
  isFinalized: boolean;
  juryScores: Array<{
    id: string;
    juryId: string;
    name: string;
    score: number;
  }>;
}
