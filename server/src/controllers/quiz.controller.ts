import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { createQuizSchema, updateQuizSchema } from '../validation/quiz.validation.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

/**
 * Maps database quiz object containing flat settings columns to nested settings QuizDto.
 */
const mapQuizToDto = (quiz: any) => {
  if (!quiz) return null;
  return {
    id: quiz.id,
    hostId: quiz.hostId,
    title: quiz.title,
    description: quiz.description,
    createdAt: quiz.createdAt.toISOString ? quiz.createdAt.toISOString() : quiz.createdAt,
    settings: {
      timePerQuestion: quiz.timePerQuestion,
      pointsMode: quiz.pointsMode,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      showLeaderboardBetweenQuestions: quiz.showLeaderboardBetweenQuestions,
      allowLateJoin: quiz.allowLateJoin,
    },
    questions: quiz.questions,
    _count: quiz._count,
  };
};

export const listQuizzes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;

    const quizzes = await prisma.quiz.findMany({
      where: { hostId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { questions: true }
        }
      }
    });

    return res.status(200).json({
      status: 'success',
      data: { quizzes: quizzes.map(mapQuizToDto) },
    });
  } catch (error) {
    next(error);
  }
};

export const createQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const input = createQuizSchema.parse(req.body);

    const quiz = await prisma.quiz.create({
      data: {
        hostId,
        title: input.title,
        description: input.description,
        timePerQuestion: input.settings.timePerQuestion,
        pointsMode: input.settings.pointsMode,
        shuffleQuestions: input.settings.shuffleQuestions,
        shuffleOptions: input.settings.shuffleOptions,
        showLeaderboardBetweenQuestions: input.settings.showLeaderboardBetweenQuestions,
        allowLateJoin: input.settings.allowLateJoin,
      },
    });

    return res.status(201).json({
      status: 'success',
      data: { quiz: mapQuizToDto(quiz) },
    });
  } catch (error) {
    next(error);
  }
};

export const getQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { id } = req.params;

    const quiz = await prisma.quiz.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          include: {
            options: true,
          },
        },
      },
    });

    if (!quiz || quiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    return res.status(200).json({
      status: 'success',
      data: { quiz: mapQuizToDto(quiz) },
    });
  } catch (error) {
    next(error);
  }
};

export const updateQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { id } = req.params;
    const input = updateQuizSchema.parse(req.body);

    // Verify ownership
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
    });

    if (!existingQuiz || existingQuiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    // Flatten update data
    const updateData: any = {};
    if (input.title !== undefined) updateData.title = input.title;
    if (input.description !== undefined) updateData.description = input.description;
    
    if (input.settings !== undefined) {
      if (input.settings.timePerQuestion !== undefined) updateData.timePerQuestion = input.settings.timePerQuestion;
      if (input.settings.pointsMode !== undefined) updateData.pointsMode = input.settings.pointsMode;
      if (input.settings.shuffleQuestions !== undefined) updateData.shuffleQuestions = input.settings.shuffleQuestions;
      if (input.settings.shuffleOptions !== undefined) updateData.shuffleOptions = input.settings.shuffleOptions;
      if (input.settings.showLeaderboardBetweenQuestions !== undefined) {
        updateData.showLeaderboardBetweenQuestions = input.settings.showLeaderboardBetweenQuestions;
      }
      if (input.settings.allowLateJoin !== undefined) updateData.allowLateJoin = input.settings.allowLateJoin;
    }

    const quiz = await prisma.quiz.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json({
      status: 'success',
      data: { quiz: mapQuizToDto(quiz) },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const hostId = req.user!.id;
    const { id } = req.params;

    // Verify ownership
    const existingQuiz = await prisma.quiz.findUnique({
      where: { id },
    });

    if (!existingQuiz || existingQuiz.hostId !== hostId) {
      throw new AppError('Quiz not found', 404);
    }

    await prisma.quiz.delete({
      where: { id },
    });

    return res.status(200).json({
      status: 'success',
      message: 'Quiz deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
