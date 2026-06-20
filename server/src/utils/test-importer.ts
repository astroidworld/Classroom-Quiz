import { validateCSV, validateBulkPaste } from './importer.js';

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`❌ Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log('🧪 Running importer tests...\n');

  // ==========================================
  // Test 1: Valid CSV Import
  // ==========================================
  const validCSV = `question,option_a,option_b,option_c,option_d,correct_option,time_limit,points
What is HTML?,Hypertext Markup Language,Home Tool Markup,Hyperlink Markup,Hot Mail,A,20,1200
CSS is for style.,True,False,,,A,15,800
`;
  const res1 = validateCSV(validCSV);
  assert(!res1.error, 'Should not return header error for valid CSV');
  assert(res1.report !== undefined, 'Report should be returned');
  assert(res1.report?.validCount === 2, 'Should parse exactly 2 valid questions');
  assert(res1.report?.invalidCount === 0, 'Should have 0 errors');
  
  const q1 = res1.report!.validQuestions[0];
  assert(q1.text === 'What is HTML?', 'First question text should match');
  assert(q1.type === 'MCQ_SINGLE', 'First question should be MCQ_SINGLE');
  assert(q1.timeLimitSec === 20, 'Time limit should be parsed');
  assert(q1.points === 1200, 'Points should be parsed');
  assert(q1.options.length === 4, 'Should contain 4 options');
  assert(q1.options[0].text === 'Hypertext Markup Language' && q1.options[0].isCorrect === true, 'A should be correct');

  const q2 = res1.report!.validQuestions[1];
  assert(q2.type === 'TRUE_FALSE', 'True/False should be auto-detected');
  assert(q2.options.length === 2, 'True/False should only have 2 options');
  console.log('✅ Test 1 Passed: Valid CSV Import parses correctly.');

  // ==========================================
  // Test 2: Invalid CSV Headers
  // ==========================================
  const invalidCSVHeaders = `question,option_a,option_b,correct_option
What is HTML?,Hypertext Markup Language,Home Tool Markup,A
`;
  const res2 = validateCSV(invalidCSVHeaders);
  assert(res2.error !== undefined, 'Should fail with header error');
  assert(res2.error!.includes('Missing columns'), 'Error message should report missing columns');
  console.log('✅ Test 2 Passed: Missing headers correctly rejected.');

  // ==========================================
  // Test 3: Invalid CSV Row Validation
  // ==========================================
  const invalidCSVRows = `question,option_a,option_b,option_c,option_d,correct_option,time_limit,points
What is HTML?,Hypertext Markup Language,Home Tool Markup,Hyperlink Markup,Hot Mail,E,20,1200
,True,False,,,A,abc,1000
`;
  const res3 = validateCSV(invalidCSVRows);
  assert(res3.report?.invalidCount === 2, 'Should find 2 invalid rows');
  assert(res3.report?.errors[0].errors.some(e => e.includes('Correct option must be')) ?? false, 'Should catch invalid option letter');
  assert(res3.report?.errors[1].errors.some(e => e.includes('Question text is required')) ?? false, 'Should catch empty question text');
  assert(res3.report?.errors[1].errors.some(e => e.includes('Time limit must be')) ?? false, 'Should catch invalid time limit integer');
  console.log('✅ Test 3 Passed: Row level validation handles errors correctly.');

  // ==========================================
  // Test 4: Bulk Paste Plain Text Import
  // ==========================================
  const pasteText = `
    Which select represents an ID?
    A) .dot
    *B) #hash
    C) *asterisk
    D) @at

    Is CSS a markup language?
    A) True
    *B) False
  `;
  const res4 = validateBulkPaste(pasteText);
  assert(res4.validCount === 2, 'Should parse 2 valid pasted questions');
  assert(res4.invalidCount === 0, 'Should have 0 errors');
  
  const pq1 = res4.validQuestions[0];
  assert(pq1.text === 'Which select represents an ID?', 'First question should match text');
  assert(pq1.type === 'MCQ_SINGLE', 'Should be MCQ_SINGLE');
  assert(pq1.options[1].text === '#hash' && pq1.options[1].isCorrect === true, 'B should be correct');

  const pq2 = res4.validQuestions[1];
  assert(pq2.type === 'TRUE_FALSE', 'True/False should be auto-detected in paste');
  assert(pq2.options[1].text === 'False' && pq2.options[1].isCorrect === true, 'False should be correct');
  console.log('✅ Test 4 Passed: Bulk paste plain text parses correctly.');

  console.log('\n🎉 All importer tests completed successfully!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
