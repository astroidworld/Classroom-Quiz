import { calculateScore, calculateQuestionScore } from '../scoring.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

function runScoringTests() {
  console.log('🧪 Running scoring function unit tests...\n');

  // Test 1: Incorrect Answer
  const r1 = calculateScore({
    isCorrect: false,
    responseTimeMs: 2000,
    timeLimitSec: 20,
    basePoints: 1000
  });
  assert(r1.pointsAwarded === 0, 'Incorrect answer must score 0 points');
  assert(r1.streakBonusAwarded === 0, 'Incorrect answer must score 0 streak bonus');
  console.log('✅ Test 1 Passed: Incorrect answer scores 0.');

  // Test 2: Instant Answer (t = 0 ms)
  const r2 = calculateScore({
    isCorrect: true,
    responseTimeMs: 0,
    timeLimitSec: 20,
    basePoints: 1000
  });
  assert(r2.pointsAwarded === 1000, 'Instant answer should score maximum base points');
  console.log('✅ Test 2 Passed: Instant response scores full base points.');

  // Test 3: Average Speed Answer (t = 10s on a 20s limit)
  const r3 = calculateScore({
    isCorrect: true,
    responseTimeMs: 10000,
    timeLimitSec: 20,
    basePoints: 1000
  });
  // 1000 * (10000 / 20000) = 500
  assert(r3.pointsAwarded === 500, 'Answer at half time should score half base points');
  console.log('✅ Test 3 Passed: Average response speed scores 50% points.');

  // Test 4: Slow Answer near expiration (t = 19.5s on a 20s limit)
  const r4 = calculateScore({
    isCorrect: true,
    responseTimeMs: 19500,
    timeLimitSec: 20,
    basePoints: 1000
  });
  // 1000 * (500 / 20000) = 25 points
  assert(r4.pointsAwarded === 25, 'Late answer should score minimal points');
  console.log('✅ Test 4 Passed: Slow response scores minimal points.');

  // Test 5: Late Answer past limit (t = 21s on a 20s limit)
  const r5 = calculateScore({
    isCorrect: true,
    responseTimeMs: 21000,
    timeLimitSec: 20,
    basePoints: 1000
  });
  assert(r5.pointsAwarded === 0, 'Response exceeding timer limit must score 0 points');
  console.log('✅ Test 5 Passed: Late answers past timeLimit score 0 points.');

  // Test 6: Double points mode
  const r6 = calculateScore({
    isCorrect: true,
    responseTimeMs: 5000,
    timeLimitSec: 20,
    basePoints: 1000,
    pointsMode: 'DOUBLE'
  });
  // 1000 * (15000 / 20000) = 750 base. Double = 1500.
  assert(r6.pointsAwarded === 1500, 'Double points mode should multiply score by 2');
  console.log('✅ Test 6 Passed: Double points mode verified.');

  // Test 7: Streak bonus enabled
  const r7 = calculateScore({
    isCorrect: true,
    responseTimeMs: 10000,
    timeLimitSec: 20,
    basePoints: 1000,
    currentStreak: 3,
    streakBonusEnabled: true
  });
  // 500 base + (3 * 50 = 150) streak bonus = 650 points
  assert(r7.pointsAwarded === 650, 'Should include streak bonus in score');
  assert(r7.streakBonusAwarded === 150, 'Should report streak bonus awarded');
  console.log('✅ Test 7 Passed: Streak bonus is calculated correctly.');

  // Test 8: Streak bonus disabled
  const r8 = calculateScore({
    isCorrect: true,
    responseTimeMs: 10000,
    timeLimitSec: 20,
    basePoints: 1000,
    currentStreak: 3,
    streakBonusEnabled: false
  });
  assert(r8.pointsAwarded === 500, 'Should not add streak bonus if disabled');
  assert(r8.streakBonusAwarded === 0, 'Should report 0 streak bonus awarded');
  console.log('✅ Test 8 Passed: Streak bonus is ignored when disabled.');

  console.log('\n🎉 All old scoring function unit tests completed successfully!');
}

function runNewScoringTests() {
  console.log('\n🧪 Running new question scoring unit tests...\n');

  const defaultEarlySubmitBonus = { enabled: false, maxBonusPoints: 50 };
  const defaultNegativeMarking = { enabled: false, mode: 'fixed' as const, value: 25 };

  // Test 1: Correct answer, no bonus, no penalty -> base speed-weighted points
  const r1 = calculateQuestionScore({
    isCorrect: true,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: defaultNegativeMarking,
  });
  // 1000 * (15000 / 20000) = 750
  assert(r1.baseAwarded === 750, 'Base awarded should be 750');
  assert(r1.earlyBonus === 0, 'Early bonus should be 0');
  assert(r1.penalty === 0, 'Penalty should be 0');
  assert(r1.total === 750, 'Total should be 750');
  console.log('✅ Test 1 Passed: Speed-weighted correct answer');

  // Test 2: Correct answer + early bonus enabled -> base + bonus, both scale with time
  const r2 = calculateQuestionScore({
    isCorrect: true,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: { enabled: true, maxBonusPoints: 100 },
    negativeMarking: defaultNegativeMarking,
  });
  // base = 750, bonus = 100 * (15000 / 20000) = 75
  assert(r2.baseAwarded === 750, 'Base awarded should be 750');
  assert(r2.earlyBonus === 75, 'Early bonus should be 75');
  assert(r2.total === 825, 'Total should be 825');
  console.log('✅ Test 2 Passed: Correct answer with early submit bonus');

  // Test 3: Correct answer at exactly 0 time remaining -> 0 base + 0 bonus
  const r3 = calculateQuestionScore({
    isCorrect: true,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 20000,
    timeLimitMs: 20000,
    earlySubmitBonus: { enabled: true, maxBonusPoints: 100 },
    negativeMarking: defaultNegativeMarking,
  });
  assert(r3.baseAwarded === 0, 'Base awarded should be 0');
  assert(r3.earlyBonus === 0, 'Early bonus should be 0');
  assert(r3.total === 0, 'Total should be 0');
  console.log('✅ Test 3 Passed: Correct answer at 0 time remaining');

  // Test 4: Correct answer at full time remaining -> full base + full bonus
  const r4 = calculateQuestionScore({
    isCorrect: true,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 0,
    timeLimitMs: 20000,
    earlySubmitBonus: { enabled: true, maxBonusPoints: 100 },
    negativeMarking: defaultNegativeMarking,
  });
  assert(r4.baseAwarded === 1000, 'Base awarded should be 1000');
  assert(r4.earlyBonus === 100, 'Early bonus should be 100');
  assert(r4.total === 1100, 'Total should be 1100');
  console.log('✅ Test 4 Passed: Correct answer at full time remaining');

  // Test 5: Wrong answer, no negative marking -> 0 points
  const r5 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: defaultNegativeMarking,
  });
  assert(r5.total === 0, 'Total should be 0');
  assert(r5.penalty === 0, 'Penalty should be 0');
  console.log('✅ Test 5 Passed: Wrong answer without negative marking');

  // Test 6: Wrong answer + fixed penalty -> -value
  const r6 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: { enabled: true, mode: 'fixed', value: 50 },
  });
  assert(r6.penalty === 50, 'Penalty should be 50');
  assert(r6.total === -50, 'Total should be -50');
  console.log('✅ Test 6 Passed: Wrong answer with fixed negative marking');

  // Test 7: Wrong answer + percentage penalty -> -(basePoints * value / 100)
  const r7 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: false,
    basePoints: 800,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: { enabled: true, mode: 'percentage', value: 25 },
  });
  // 800 * 0.25 = 200
  assert(r7.penalty === 200, 'Penalty should be 200');
  assert(r7.total === -200, 'Total should be -200');
  console.log('✅ Test 7 Passed: Wrong answer with percentage negative marking');

  // Test 8: Unanswered -> 0 everything, regardless of penalty settings
  const r8 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: true,
    basePoints: 1000,
    responseTimeMs: 20000,
    timeLimitMs: 20000,
    earlySubmitBonus: { enabled: true, maxBonusPoints: 100 },
    negativeMarking: { enabled: true, mode: 'fixed', value: 50 },
  });
  assert(r8.total === 0, 'Total should be 0');
  assert(r8.penalty === 0, 'Penalty should be 0');
  assert(r8.earlyBonus === 0, 'Early bonus should be 0');
  console.log('✅ Test 8 Passed: Unanswered question receives 0 penalty/points');

  // Test 9: Edge: negative marking enabled but value = 0 -> 0 penalty
  const r9 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 5000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: { enabled: true, mode: 'fixed', value: 0 },
  });
  assert(r9.penalty === 0, 'Penalty should be 0');
  assert(r9.total === 0, 'Total should be 0');
  console.log('✅ Test 9 Passed: Negative marking enabled with 0 value');

  // Test 10: Verify total never awards positive points for wrong answers
  const r10 = calculateQuestionScore({
    isCorrect: false,
    isUnanswered: false,
    basePoints: 1000,
    responseTimeMs: 1000,
    timeLimitMs: 20000,
    earlySubmitBonus: defaultEarlySubmitBonus,
    negativeMarking: { enabled: true, mode: 'fixed', value: -10 },
  });
  assert(r10.total <= 0, 'Total should never be positive for wrong answers');
  console.log('✅ Test 10 Passed: Wrong answers never earn positive points');

  console.log('\n🎉 All new question scoring unit tests completed successfully!');
}

try {
  runScoringTests();
  runNewScoringTests();
  console.log('\n🌟 ALL UNIT TESTS PASSED SUCCESSFULLY! 🌟\n');
} catch (e) {
  console.error(e);
  process.exit(1);
}
