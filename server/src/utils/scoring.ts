export interface ScoreParams {
  isCorrect: boolean;
  responseTimeMs: number;
  timeLimitSec: number;
  basePoints?: number;
  pointsMode?: 'STANDARD' | 'DOUBLE' | 'NONE';
  currentStreak?: number;
  streakBonusEnabled?: boolean;
}

export interface ScoreResult {
  pointsAwarded: number;
  streakBonusAwarded: number;
}

/**
 * Calculates score based on correctness, response speed, and answer streaks.
 */
export function calculateScore({
  isCorrect,
  responseTimeMs,
  timeLimitSec,
  basePoints = 1000,
  pointsMode = 'STANDARD',
  currentStreak = 0,
  streakBonusEnabled = false,
}: ScoreParams): ScoreResult {
  if (!isCorrect || pointsMode === 'NONE') {
    return { pointsAwarded: 0, streakBonusAwarded: 0 };
  }

  const timeLimitMs = timeLimitSec * 1000;
  
  // Guard response time bounds (negative or network latency grace buffer)
  const boundedResponseTime = Math.max(0, Math.min(responseTimeMs, timeLimitMs));
  const timeRemainingMs = timeLimitMs - boundedResponseTime;

  // Standard speed bonus formula: points = basePoints * (timeRemaining / timeLimit)
  let points = basePoints * (timeRemainingMs / timeLimitMs);
  points = Math.round(points);

  if (pointsMode === 'DOUBLE') {
    points = points * 2;
  }

  // Calculate streak bonus
  let streakBonus = 0;
  if (streakBonusEnabled && currentStreak > 0) {
    // Award +50 points per streak level, capped at +250 points (streak of 5)
    streakBonus = Math.min(currentStreak, 5) * 50;
  }

  return {
    pointsAwarded: points + streakBonus,
    streakBonusAwarded: streakBonus,
  };
}
