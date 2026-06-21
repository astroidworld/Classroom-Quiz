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

export interface QuestionScoreParams {
  isCorrect: boolean;
  isUnanswered: boolean;           // selectedOptionId === null
  basePoints: number;              // question.points
  responseTimeMs: number;
  timeLimitMs: number;
  earlySubmitBonus: { enabled: boolean; maxBonusPoints: number };
  negativeMarking: { enabled: boolean; mode: 'fixed' | 'percentage'; value: number };
}

export interface QuestionScoreResult {
  total: number;
  baseAwarded: number;
  earlyBonus: number;
  penalty: number;
}

export function calculateQuestionScore(params: QuestionScoreParams): QuestionScoreResult {
  // Unanswered = always 0 points, no penalty, no bonus
  if (params.isUnanswered) {
    return { total: 0, baseAwarded: 0, earlyBonus: 0, penalty: 0 };
  }

  const timeRemainingMs = Math.max(params.timeLimitMs - params.responseTimeMs, 0);

  if (params.isCorrect) {
    // Base points (speed-weighted)
    const baseAwarded = Math.round(
      params.basePoints * (timeRemainingMs / params.timeLimitMs)
    );

    // Early submit bonus (only for correct answers, scales with remaining time)
    let earlyBonus = 0;
    if (params.earlySubmitBonus.enabled) {
      earlyBonus = Math.round(
        params.earlySubmitBonus.maxBonusPoints * (timeRemainingMs / params.timeLimitMs)
      );
    }

    return {
      total: baseAwarded + earlyBonus,
      baseAwarded,
      earlyBonus,
      penalty: 0
    };
  }

  // Wrong answer — apply negative marking if enabled
  let penalty = 0;
  if (params.negativeMarking.enabled) {
    if (params.negativeMarking.mode === 'fixed') {
      penalty = params.negativeMarking.value;
    } else {
      // percentage of base points
      penalty = Math.round(params.basePoints * (params.negativeMarking.value / 100));
    }
  }

  // Ensure penalty is non-negative to avoid awarding positive points
  penalty = Math.max(0, penalty);

  return {
    total: -penalty,
    baseAwarded: 0,
    earlyBonus: 0,
    penalty
  };
}
