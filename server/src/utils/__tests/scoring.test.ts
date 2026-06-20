import { calculateScore } from '../scoring.js';

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

  console.log('\n🎉 All scoring function unit tests completed successfully!');
}

try {
  runScoringTests();
} catch (e) {
  console.error(e);
  process.exit(1);
}
