import { z } from 'zod';
import { PointsMode, QuestionType } from '@prisma/client';

export const createQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long'),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  settings: z.object({
    timePerQuestion: z.number().int().min(5).max(300).default(30),
    pointsMode: z.nativeEnum(PointsMode).default(PointsMode.STANDARD),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    showLeaderboardBetweenQuestions: z.boolean().default(true),
    allowLateJoin: z.boolean().default(true),
    submissionMode: z.enum(['auto', 'manual']).default('manual'),
    earlySubmitBonus: z.object({
      enabled: z.boolean().default(false),
      maxBonusPoints: z.number().int().min(0).max(1000).default(50),
    }).default({ enabled: false, maxBonusPoints: 50 }),
    negativeMarking: z.object({
      enabled: z.boolean().default(false),
      mode: z.enum(['fixed', 'percentage']).default('fixed'),
      value: z.number().min(0).max(1000).default(25),
    }).default({ enabled: false, mode: 'fixed', value: 25 }),
    resultScreenDuration: z.object({
      correctSec: z.number().int().min(1).max(30).default(3),
      incorrectSec: z.number().int().min(1).max(30).default(3),
    }).default({ correctSec: 3, incorrectSec: 3 }),
  }).default({}),
});

export const updateQuizSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title is too long').optional(),
  description: z.string().max(500, 'Description is too long').optional().nullable(),
  settings: z.object({
    timePerQuestion: z.number().int().min(5).max(300).optional(),
    pointsMode: z.nativeEnum(PointsMode).optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    showLeaderboardBetweenQuestions: z.boolean().optional(),
    allowLateJoin: z.boolean().optional(),
    submissionMode: z.enum(['auto', 'manual']).optional(),
    earlySubmitBonus: z.object({
      enabled: z.boolean().optional(),
      maxBonusPoints: z.number().int().min(0).max(1000).optional(),
    }).optional(),
    negativeMarking: z.object({
      enabled: z.boolean().optional(),
      mode: z.enum(['fixed', 'percentage']).optional(),
      value: z.number().min(0).max(1000).optional(),
    }).optional(),
    resultScreenDuration: z.object({
      correctSec: z.number().int().min(1).max(30).optional(),
      incorrectSec: z.number().int().min(1).max(30).optional(),
    }).optional(),
  }).optional(),
});

export const optionSchema = z.object({
  id: z.string().uuid().optional(),
  text: z.string().min(1, 'Option text is required').max(200, 'Option text is too long'),
  isCorrect: z.boolean(),
});

const questionBaseObject = z.object({
  text: z.string().min(1, 'Question text is required').max(500, 'Question text is too long'),
  type: z.nativeEnum(QuestionType).default(QuestionType.MCQ_SINGLE),
  imageUrl: z.string().url('Invalid image URL').optional().nullable().or(z.literal('')),
  timeLimitSec: z.number().int().min(5).max(300).optional().nullable(),
  points: z.number().int().min(0).max(10000).default(1000),
  explanation: z.string().max(1000, 'Explanation is too long').optional().nullable(),
  codeSnippet: z.string().optional().nullable(),
  codeLanguage: z.string().optional().nullable(),
  options: z.array(optionSchema).min(2, 'At least two options are required').max(6, 'At most six options are allowed'),
});

export const createQuestionSchema = questionBaseObject.refine((data) => {
  const correctCount = data.options.filter(o => o.isCorrect).length;
  return correctCount === 1;
}, {
  message: 'Exactly one option must be marked as correct.',
  path: ['options'],
});

export const updateQuestionSchema = questionBaseObject.partial().refine((data) => {
  if (data.options === undefined) return true;
  const correctCount = data.options.filter(o => o?.isCorrect).length;
  return correctCount === 1;
}, {
  message: 'Exactly one option must be marked as correct.',
  path: ['options'],
});

export const reorderQuestionsSchema = z.object({
  orders: z.array(
    z.object({
      id: z.string().uuid(),
      order: z.number().int().nonnegative(),
    })
  ),
});

export type CreateQuizInput = z.infer<typeof createQuizSchema>;
export type UpdateQuizInput = z.infer<typeof updateQuizSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;
export type ReorderQuestionsInput = z.infer<typeof reorderQuestionsSchema>;
export type OptionInput = z.infer<typeof optionSchema>;
