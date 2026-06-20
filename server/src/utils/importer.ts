import Papa from 'papaparse';

export interface ParsedQuestion {
  text: string;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  timeLimitSec: number | null;
  points: number;
  explanation?: string | null;
  options: { text: string; isCorrect: boolean }[];
}

export interface ImportErrorRow {
  row: number; // For CSV: line number. For paste: question block number.
  questionText: string;
  errors: string[];
}

export interface ValidationReport {
  validCount: number;
  invalidCount: number;
  validQuestions: ParsedQuestion[];
  errors: ImportErrorRow[];
}

const REQUIRED_HEADERS = [
  'question',
  'option_a',
  'option_b',
  'option_c',
  'option_d',
  'correct_option',
  'time_limit',
  'points'
];

/**
 * Validates and parses CSV contents.
 */
export const validateCSV = (csvContent: string): { error?: string; report?: ValidationReport } => {
  const parsed = Papa.parse<Record<string, string>>(csvContent.trim(), {
    header: true,
    skipEmptyLines: true,
  });

  const headers = parsed.meta.fields || [];
  const missingHeaders = REQUIRED_HEADERS.filter(h => !headers.includes(h));

  if (missingHeaders.length > 0) {
    return {
      error: `Invalid CSV headers. Missing columns: ${missingHeaders.join(', ')}. Expected format: ${REQUIRED_HEADERS.join(',')}`
    };
  }

  const validQuestions: ParsedQuestion[] = [];
  const errors: ImportErrorRow[] = [];

  parsed.data.forEach((row, index) => {
    const rowNum = index + 2; // 1-indexed + header row
    const questionText = (row.question || '').trim();
    const optionA = (row.option_a || '').trim();
    const optionB = (row.option_b || '').trim();
    const optionC = (row.option_c || '').trim();
    const optionD = (row.option_d || '').trim();
    const correctLetter = (row.correct_option || '').trim().toUpperCase();
    const timeLimitStr = (row.time_limit || '').trim();
    const pointsStr = (row.points || '').trim();

    const rowErrors: string[] = [];

    if (!questionText) {
      rowErrors.push('Question text is required.');
    }

    if (!optionA || !optionB) {
      rowErrors.push('At least two options (option_a and option_b) are required.');
    }

    const isTrueFalse = 
      (optionA.toLowerCase() === 'true' && optionB.toLowerCase() === 'false') || 
      (optionA.toLowerCase() === 'false' && optionB.toLowerCase() === 'true');

    // Determine type
    const type = isTrueFalse ? 'TRUE_FALSE' : 'MCQ_SINGLE';

    // If MCQ_SINGLE, we must check if option_c and option_d are set.
    if (type === 'MCQ_SINGLE' && (!optionC || !optionD)) {
      rowErrors.push('MCQ questions require all 4 options (option_a, option_b, option_c, option_d) to be filled.');
    }

    // Validate correct option letter
    const allowedLetters = type === 'TRUE_FALSE' ? ['A', 'B'] : ['A', 'B', 'C', 'D'];
    if (!correctLetter || !allowedLetters.includes(correctLetter)) {
      rowErrors.push(`Correct option must be one of the following: ${allowedLetters.join(', ')}.`);
    }

    // Parse options
    const options = [
      { text: optionA, isCorrect: correctLetter === 'A' },
      { text: optionB, isCorrect: correctLetter === 'B' },
      ...(optionC ? [{ text: optionC, isCorrect: correctLetter === 'C' }] : []),
      ...(optionD ? [{ text: optionD, isCorrect: correctLetter === 'D' }] : []),
    ];

    // Ensure at least one correct option exists in parsed array
    if (!options.some(o => o.isCorrect)) {
      rowErrors.push('You must mark exactly one correct option.');
    }

    // Validate integers
    let timeLimitSec: number | null = null;
    if (timeLimitStr) {
      const parsedTime = parseInt(timeLimitStr, 10);
      if (isNaN(parsedTime) || parsedTime <= 0) {
        rowErrors.push('Time limit must be a positive integer.');
      } else {
        timeLimitSec = parsedTime;
      }
    }

    let points = 1000;
    if (pointsStr) {
      const parsedPoints = parseInt(pointsStr, 10);
      if (isNaN(parsedPoints) || parsedPoints < 0) {
        rowErrors.push('Points must be a non-negative integer.');
      } else {
        points = parsedPoints;
      }
    }

    if (rowErrors.length > 0) {
      errors.push({
        row: rowNum,
        questionText: questionText || `[Row ${rowNum} Missing Text]`,
        errors: rowErrors
      });
    } else {
      validQuestions.push({
        text: questionText,
        type,
        timeLimitSec,
        points,
        options,
        explanation: null
      });
    }
  });

  return {
    report: {
      validCount: validQuestions.length,
      invalidCount: errors.length,
      validQuestions,
      errors
    }
  };
};

/**
 * Validates and parses bulk paste plain text.
 */
export const validateBulkPaste = (text: string): ValidationReport => {
  const validQuestions: ParsedQuestion[] = [];
  const errors: ImportErrorRow[] = [];

  // Split into blocks separated by blank lines
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(b => b.length > 0);

  blocks.forEach((block, index) => {
    const blockNum = index + 1;
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    if (lines.length < 3) {
      errors.push({
        row: blockNum,
        questionText: lines[0] || `[Block ${blockNum} Empty]`,
        errors: ['A question block must contain a question and at least two options.']
      });
      return;
    }

    const questionText = lines[0];
    const optionLines = lines.slice(1);
    const rowErrors: string[] = [];
    const options: { text: string; isCorrect: boolean }[] = [];

    // Parse options
    optionLines.forEach((line) => {
      // Matches lines like: *A) OptionText or B. OptionText or *True
      const optionRegex = /^(\*?)\s*(?:([A-F]|[a-f])[\).]\s*)?(.*)$/;
      const match = line.match(optionRegex);

      if (match) {
        const isCorrect = match[1] === '*';
        let optionText = match[3].trim();
        
        // In case there is no letter prefix, but just the option text (e.g. *True)
        if (!optionText && match[2]) {
          optionText = match[2];
        }

        if (optionText) {
          options.push({ text: optionText, isCorrect });
        } else {
          rowErrors.push(`Failed to parse option text from line: "${line}"`);
        }
      } else {
        rowErrors.push(`Failed to parse option line: "${line}"`);
      }
    });

    if (options.length < 2) {
      rowErrors.push('At least two valid options are required.');
    }

    const correctCount = options.filter(o => o.isCorrect).length;
    if (correctCount === 0) {
      rowErrors.push('You must mark exactly one correct option by prefixing it with an asterisk (*).');
    } else if (correctCount > 1) {
      rowErrors.push('Multiple correct options found. Please mark exactly one correct option.');
    }

    const hasTrue = options.some(o => o.text.toLowerCase() === 'true');
    const hasFalse = options.some(o => o.text.toLowerCase() === 'false');
    const type = (options.length === 2 && hasTrue && hasFalse) ? 'TRUE_FALSE' : 'MCQ_SINGLE';

    if (rowErrors.length > 0) {
      errors.push({
        row: blockNum,
        questionText,
        errors: rowErrors
      });
    } else {
      validQuestions.push({
        text: questionText,
        type,
        timeLimitSec: null, // Default
        points: 1000,
        options,
        explanation: null
      });
    }
  });

  return {
    validCount: validQuestions.length,
    invalidCount: errors.length,
    validQuestions,
    errors
  };
};
