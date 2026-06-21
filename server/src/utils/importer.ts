import Papa from 'papaparse';

export interface ParsedQuestion {
  text: string;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  timeLimitSec: number | null;
  points: number;
  explanation?: string | null;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  codePreview?: string | null;
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

const SUPPORTED_LANGUAGES = [
  'python', 'javascript', 'typescript', 'java', 'c', 'cpp', 
  'html', 'css', 'sql', 'go', 'rust', 'php', 'ruby', 'bash', 'text'
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

    // Code Snippet & Language Fields (Optional)
    const codeSnippetRaw = row.code_snippet; 
    const codeLanguageRaw = row.code_language ? row.code_language.trim().toLowerCase() : null;

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

    // Parse code block
    let codeSnippet: string | null = null;
    let codeLanguage: string | null = null;
    let codePreview: string | null = null;

    if (codeSnippetRaw && codeSnippetRaw.length > 0) {
      codeSnippet = codeSnippetRaw; // Indentation preserved
      if (codeLanguageRaw) {
        if (SUPPORTED_LANGUAGES.includes(codeLanguageRaw)) {
          codeLanguage = codeLanguageRaw;
        } else {
          codeLanguage = 'text'; // Default to text
        }
      } else {
        codeLanguage = 'text';
      }

      const snippetLines = codeSnippet.split('\n');
      codePreview = snippetLines.slice(0, 2).join('\n') + (snippetLines.length > 2 ? '\n...' : '');
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
        codeSnippet,
        codeLanguage,
        codePreview,
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
 * Splits bulk paste string into blocks respecting backtick code fences.
 */
export const splitBulkPasteIntoBlocks = (text: string): string[] => {
  const lines = text.split(/\r?\n/);
  const blocks: string[] = [];
  let currentBlock: string[] = [];
  let inCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inCode = !inCode;
    }

    if (!inCode && trimmed === '') {
      if (currentBlock.length > 0) {
        blocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
    } else {
      currentBlock.push(line);
    }
  }

  if (currentBlock.length > 0) {
    blocks.push(currentBlock.join('\n'));
  }

  return blocks.map(b => b.trim()).filter(b => b.length > 0);
};

/**
 * Validates and parses bulk paste plain text.
 */
export const validateBulkPaste = (text: string): ValidationReport => {
  const validQuestions: ParsedQuestion[] = [];
  const errors: ImportErrorRow[] = [];

  const blocks = splitBulkPasteIntoBlocks(text);

  blocks.forEach((block, index) => {
    const blockNum = index + 1;
    
    // Check for fenced code block ```
    const backtickStart = block.indexOf('```');
    const backtickEnd = block.lastIndexOf('```');

    let questionText = '';
    let codeSnippet: string | null = null;
    let codeLanguage: string | null = null;
    let codePreview: string | null = null;
    let optionLines: string[] = [];

    if (backtickStart !== -1 && backtickEnd !== -1 && backtickEnd > backtickStart) {
      questionText = block.substring(0, backtickStart).trim();

      const snippetContent = block.substring(backtickStart + 3, backtickEnd);
      const firstNewlineIndex = snippetContent.indexOf('\n');
      
      let rawSnippet = '';
      if (firstNewlineIndex !== -1) {
        const lang = snippetContent.substring(0, firstNewlineIndex).trim().toLowerCase();
        codeLanguage = lang && SUPPORTED_LANGUAGES.includes(lang) ? lang : 'text';
        rawSnippet = snippetContent.substring(firstNewlineIndex + 1);
      } else {
        codeLanguage = 'text';
        rawSnippet = snippetContent;
      }
      
      codeSnippet = rawSnippet; // Indentation preserved

      const snippetLines = codeSnippet.split('\n');
      codePreview = snippetLines.slice(0, 2).join('\n') + (snippetLines.length > 2 ? '\n...' : '');

      const optionsPart = block.substring(backtickEnd + 3);
      optionLines = optionsPart.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    } else {
      const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 3) {
        errors.push({
          row: blockNum,
          questionText: lines[0] || `[Block ${blockNum} Empty]`,
          errors: ['A question block must contain a question and at least two options.']
        });
        return;
      }
      questionText = lines[0];
      optionLines = lines.slice(1);
    }

    const rowErrors: string[] = [];
    const options: { text: string; isCorrect: boolean }[] = [];

    // Parse options
    optionLines.forEach((line) => {
      const optionRegex = /^(\*?)\s*(?:([A-F]|[a-f])[\).]\s*)?(.*)$/;
      const match = line.match(optionRegex);

      if (match) {
        const isCorrect = match[1] === '*';
        let optionText = match[3].trim();
        
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
        codeSnippet,
        codeLanguage,
        codePreview,
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
