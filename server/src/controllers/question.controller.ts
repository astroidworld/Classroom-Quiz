import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { createQuestionSchema, updateQuestionSchema, reorderQuestionsSchema } from '../validation/quiz.validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const addQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { quizId } = req.params;
    const input = createQuestionSchema.parse(req.body);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Determine the next order index
    const aggregate = await prisma.question.aggregate({
      where: { quizId },
      _max: { order: true },
    });
    const nextOrder = (aggregate._max.order ?? 0) + 1;

    // Create question and options inside a transaction
    const question = await prisma.$transaction(async (tx) => {
      const q = await tx.question.create({
        data: {
          quizId,
          order: nextOrder,
          text: input.text,
          type: input.type,
          imageUrl: input.imageUrl,
          timeLimitSec: input.timeLimitSec,
          points: input.points,
          explanation: input.explanation,
        },
      });

      // Bulk create options
      await tx.option.createMany({
        data: input.options.map((opt) => ({
          questionId: q.id,
          text: opt.text,
          isCorrect: opt.isCorrect,
        })),
      });

      // Query question with options to return
      return tx.question.findUnique({
        where: { id: q.id },
        include: { options: true },
      });
    });

    return res.status(201).json({
      status: 'success',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { quizId, questionId } = req.params;
    const input = updateQuestionSchema.parse(req.body);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Verify question belongs to the quiz
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion || existingQuestion.quizId !== quizId) {
      throw new AppError('Question not found in this quiz', 404);
    }

    // Update inside a transaction
    const question = await prisma.$transaction(async (tx) => {
      const updatedQ = await tx.question.update({
        where: { id: questionId },
        data: {
          text: input.text,
          type: input.type,
          imageUrl: input.imageUrl,
          timeLimitSec: input.timeLimitSec,
          points: input.points,
          explanation: input.explanation,
        },
      });

      // If options were passed, drop existing and recreate
      if (input.options) {
        await tx.option.deleteMany({
          where: { questionId },
        });

        await tx.option.createMany({
          data: input.options.map((opt) => ({
            questionId,
            text: opt.text,
            isCorrect: opt.isCorrect,
          })),
        });
      }

      return tx.question.findUnique({
        where: { id: questionId },
        include: { options: true },
      });
    });

    return res.status(200).json({
      status: 'success',
      data: { question },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuestion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { quizId, questionId } = req.params;

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Verify question belongs to quiz
    const existingQuestion = await prisma.question.findUnique({
      where: { id: questionId },
    });

    if (!existingQuestion || existingQuestion.quizId !== quizId) {
      throw new AppError('Question not found in this quiz', 404);
    }

    // Delete question (cascades to options)
    await prisma.question.delete({
      where: { id: questionId },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Question deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

export const reorderQuestions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { quizId } = req.params;
    const { orders } = reorderQuestionsSchema.parse(req.body);

    // Verify quiz ownership
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Update order indexes in a transaction
    await prisma.$transaction(
      orders.map((item) =>
        prisma.question.update({
          where: { id: item.id, quizId },
          data: { order: item.order },
        })
      )
    );

    return res.status(200).json({
      status: 'success',
      message: 'Questions reordered successfully',
    });
  } catch (error) {
    next(error);
  }
};
