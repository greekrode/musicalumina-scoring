import { expect, test } from 'bun:test';
import { averageScore } from './averageScore';

test('band boundaries are exact', () => {
  expect(averageScore([74.9, 75.1, 75, 75])).toBe(75);
  expect(averageScore([84.9, 85.1, 85, 85])).toBe(85);
  expect(averageScore([84.9, 85, 85])).toBe(84.97);
  expect(averageScore([])).toBe(0);
});

test('equal sums tie exactly', () => {
  expect(averageScore([80.1, 79.9, 80])).toBe(averageScore([80, 80, 80]));
});
