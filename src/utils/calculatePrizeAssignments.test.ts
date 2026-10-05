import { expect, test } from 'bun:test';
import { PrizeConfiguration } from '../types';
import { ParticipantWithScores } from '../types/results';
import { calculatePrizeAssignments } from './calculatePrizeAssignments';

// The 2026 (2nd Edition) ladder: High Scorer (>90, one per group), then bands.
const ladder: PrizeConfiguration[] = [
  ['High Scorer', 1, 90.01, 100, 1],
  ['Gold', 20, 85, 100, 2],
  ['Silver', 20, 75, 84.99, 3],
  ['Bronze', 20, 0, 74.99, 4],
].map(([prize_level, max_winners, min_score, max_score, display_order], i) => ({
  id: String(i), event_id: 'e', category_id: 'c', subcategory_id: 's', active: true,
  prize_level, max_winners, min_score, max_score, display_order,
}) as PrizeConfiguration);

const people = (scores: number[]): ParticipantWithScores[] =>
  scores.map((averageScore, i) => ({
    id: `p${i}`, number: i + 1, fullName: `P${i}`, averageScore, scoreCount: 3, category: '', piece: '',
    duration: '', aspectScores: {}, isFinalized: false, juryScores: [],
  }));

const prizes = (scores: number[]) =>
  Object.fromEntries(
    calculatePrizeAssignments(people(scores), ladder).assignedParticipants.map((p) => [p.averageScore, p.prizeLevel])
  );

test('only the top score above 90 is High Scorer; the rest fall into bands', () => {
  expect(prizes([95, 92.5, 88, 85, 84.99, 75, 70])).toEqual({
    95: 'High Scorer', 92.5: 'Gold', 88: 'Gold', 85: 'Gold', 84.99: 'Silver', 75: 'Silver', 70: 'Bronze',
  });
});

test('exactly 90 is not above 90', () => {
  expect(prizes([90, 89])).toEqual({ 90: 'Gold', 89: 'Gold' });
});

test('a tie for the top score above 90 shares High Scorer', () => {
  const result = calculatePrizeAssignments(people([93, 93, 91]), ladder).assignedParticipants;
  expect(result.map((p) => p.prizeLevel)).toEqual(['High Scorer', 'High Scorer', 'Gold']);
});
