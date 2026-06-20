import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { validateCSV, validateBulkPaste, ParsedQuestion } from '../utils/importer.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { z } from 'zod';

const validateImportSchema = z.object({
  format: z.enum(['csv', 'paste']),
  content: z.string().min(1, 'Import content cannot be empty'),
});

const commitImportSchema = z.object({
  questions: z.array(
    z.object({
      text: z.string().min(1),
      type: z.enum(['MCQ_SINGLE', 'TRUE_FALSE']),
      timeLimitSec: z.number().int().positive().nullable(),
      points: z.number().int().nonnegative(),
      options: z.array(
        z.object({
          text: z.string().min(1),
          isCorrect: z.boolean(),
        })
      ).min(2),
    })
  ).min(1, 'No questions to import'),
});

export const validateImport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { format, content } = validateImportSchema.parse(req.body);

    if (format === 'csv') {
      const { error, report } = validateCSV(content);
      if (error) {
        return res.status(400).json({
          status: 'error',
          message: error,
        });
      }
      return res.status(200).json({
        status: 'success',
        data: report,
      });
    } else {
      const report = validateBulkPaste(content);
      return res.status(200).json({
        status: 'success',
        data: report,
      });
    }
  } catch (error) {
    next(error);
  }
};

export const commitImport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { quizId } = req.params;
    const { questions } = commitImportSchema.parse(req.body);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Determine starting order index
    const aggregate = await prisma.question.aggregate({
      where: { quizId },
      _max: { order: true },
    });
    let currentOrder = aggregate._max.order ?? 0;

    // Save questions and options inside a transaction
    const importedQuestions = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const q of questions) {
        currentOrder += 1;
        const createdQ = await tx.question.create({
          data: {
            quizId,
            order: currentOrder,
            text: q.text,
            type: q.type,
            timeLimitSec: q.timeLimitSec,
            points: q.points,
          },
        });

        // Bulk insert options
        await tx.option.createMany({
          data: q.options.map((opt) => ({
            questionId: createdQ.id,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        });

        results.push(createdQ.id);
      }

      // Return the created questions with options
      return tx.question.findMany({
        where: { id: { in: results } },
        include: { options: true },
        orderBy: { order: 'asc' },
      });
    });

    return res.status(201).json({
      status: 'success',
      data: { questions: importedQuestions },
    });
  } catch (error) {
    next(error);
  }
};
