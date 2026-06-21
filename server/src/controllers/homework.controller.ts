import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middleware/error.middleware.js';
import { calculateScore } from '../utils/scoring.js';
import { SessionStatus, SessionMode } from '@prisma/client';

/**
 * Validate a 6-digit Join Code for Live or Homework sessions.
 */
export const validateJoinCode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { joinCode } = req.body;
    if (!joinCode || typeof joinCode !== 'string') {
      throw new AppError('Join code is required', 400);
    }

    const session = await prisma.session.findUnique({
      where: { joinCode },
      include: { quiz: true },
    });

    if (!session) {
      return res.status(200).json({
        status: 'success',
        data: { valid: false, message: 'Classroom code not found.' },
      });
    }

    if (session.status === SessionStatus.ENDED) {
      return res.status(200).json({
        status: 'success',
        data: { valid: false, message: 'This quiz session has already ended.' },
      });
    }

    // Homework validity checks
    if (session.mode === SessionMode.HOMEWORK) {
      const now = new Date();
      if (session.homeworkStart && now < session.homeworkStart) {
        return res.status(200).json({
          status: 'success',
          data: { 
            valid: false, 
            message: `This homework quiz has not started yet. Opens at: ${session.homeworkStart.toLocaleString()}` 
          },
        });
      }

      if (session.homeworkEnd && now > session.homeworkEnd) {
        return res.status(200).json({
          status: 'success',
          data: { 
            valid: false, 
            message: `This homework session closed at: ${session.homeworkEnd.toLocaleString()}` 
          },
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        valid: true,
        mode: session.mode,
        quizTitle: session.quiz.title,
        homeworkStart: session.homeworkStart ? session.homeworkStart.toISOString() : null,
        homeworkEnd: session.homeworkEnd ? session.homeworkEnd.toISOString() : null,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Register student joining Homework session.
 */
export const joinHomeworkSession = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { joinCode, displayName } = req.body;
    const name = displayName?.trim();

    if (!joinCode || !name) {
      throw new AppError('Join code and display name are required', 400);
    }

    const session = await prisma.session.findUnique({
      where: { joinCode },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!session || session.mode !== SessionMode.HOMEWORK) {
      throw new AppError('Homework session not found or inactive', 404);
    }

    // Date validations
    const now = new Date();
    if (session.homeworkStart && now < session.homeworkStart) {
      throw new AppError('Homework session has not started yet', 400);
    }
    if (session.homeworkEnd && now > session.homeworkEnd) {
      throw new AppError('Homework session is closed', 400);
    }

    // Check display name uniqueness within this session
    const existing = await prisma.participant.findUnique({
      where: {
        sessionId_displayName: {
          sessionId: session.id,
          displayName: name,
        },
      },
    });

    if (existing) {
      throw new AppError('Display name is already taken in this room.', 409);
    }

    const questions = session.quiz.questions;
    if (questions.length === 0) {
      throw new AppError('This quiz does not have any questions.', 400);
    }

    const firstQuestion = questions[0];

    // Create participant
    const participant = await prisma.participant.create({
      data: {
        sessionId: session.id,
        displayName: name,
        currentQuestionId: firstQuestion.id,
        currentQuestionStartedAt: new Date(),
      },
    });

    // Format response matching shared/src/api-contracts.ts
    // Query options for first question
    const options = await prisma.option.findMany({
      where: { questionId: firstQuestion.id },
      select: { id: true, text: true },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        participantId: participant.id,
        sessionId: session.id,
        quizTitle: session.quiz.title,
        totalQuestions: questions.length,
        firstQuestion: {
          id: firstQuestion.id,
          order: firstQuestion.order,
          text: firstQuestion.text,
          imageUrl: firstQuestion.imageUrl,
          type: firstQuestion.type,
          timeLimitSec: firstQuestion.timeLimitSec ?? session.quiz.timePerQuestion,
          codeSnippet: firstQuestion.codeSnippet,
          codeLanguage: firstQuestion.codeLanguage,
          options,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch a student's active question.
 */
export const getHomeworkQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { participantId } = req.params;

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        session: {
          include: {
            quiz: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!participant) {
      throw new AppError('Participant not found', 404);
    }

    const session = participant.session;
    const questions = session.quiz.questions;

    if (participant.isCompleted) {
      // Completed, return summary
      const correctAnswers = participant.answers.filter(a => a.isCorrect).length;
      const accuracy = participant.answers.length > 0 
        ? Math.round((correctAnswers / participant.answers.length) * 100)
        : 0;

      return res.status(200).json({
        status: 'success',
        data: {
          completed: true,
          scoreSummary: {
            finalScore: participant.finalScore,
            accuracy,
            totalAnswered: participant.answers.length,
          },
        },
      });
    }

    if (!participant.currentQuestionId) {
      throw new AppError('No active question set', 400);
    }

    // Load active question details
    const activeQuestion = questions.find(q => q.id === participant.currentQuestionId);
    if (!activeQuestion) {
      throw new AppError('Question not found', 404);
    }

    // If start timestamp is not set (e.g. reload or next transition), set it now
    let updatedStartedAt = participant.currentQuestionStartedAt;
    if (!updatedStartedAt) {
      updatedStartedAt = new Date();
      await prisma.participant.update({
        where: { id: participant.id },
        data: { currentQuestionStartedAt: updatedStartedAt },
      });
    }

    const options = await prisma.option.findMany({
      where: { questionId: activeQuestion.id },
      select: { id: true, text: true },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        completed: false,
        questionIndex: activeQuestion.order,
        totalQuestions: questions.length,
        question: {
          id: activeQuestion.id,
          order: activeQuestion.order,
          text: activeQuestion.text,
          imageUrl: activeQuestion.imageUrl,
          type: activeQuestion.type,
          timeLimitSec: activeQuestion.timeLimitSec ?? session.quiz.timePerQuestion,
          codeSnippet: activeQuestion.codeSnippet,
          codeLanguage: activeQuestion.codeLanguage,
          options,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Submit answer for the active homework question.
 */
export const submitHomeworkAnswer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { participantId } = req.params;
    const { questionId, optionId } = req.body;

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        session: {
          include: {
            quiz: true,
          },
        },
      },
    });

    if (!participant) {
      throw new AppError('Participant not found', 404);
    }

    if (participant.isCompleted) {
      throw new AppError('Homework session has already been completed', 400);
    }

    if (participant.currentQuestionId !== questionId) {
      throw new AppError('Mismatch in active question to answer', 400);
    }

    if (!participant.currentQuestionStartedAt) {
      throw new AppError('Timing token not initialized', 400);
    }

    // Calculate response speed
    const responseTimeMs = Date.now() - participant.currentQuestionStartedAt.getTime();

    // Verify option correctness
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { options: true },
    });

    if (!question) {
      throw new AppError('Question not found', 404);
    }

    const selectedOption = question.options.find(o => o.id === optionId);
    if (!selectedOption) {
      throw new AppError('Selected option not found in question', 404);
    }

    const correctOption = question.options.find(o => o.isCorrect);
    if (!correctOption) {
      throw new AppError('Correct option missing in database', 500);
    }

    const isCorrect = selectedOption.isCorrect;

    // Fetch previous answers to calculate streaks (homework is self-paced but streaks still apply)
    const prevAnswers = await prisma.answer.findMany({
      where: { participantId },
      orderBy: { answeredAt: 'desc' },
    });

    let streak = 0;
    if (isCorrect) {
      for (const ans of prevAnswers) {
        if (ans.isCorrect) {
          streak += 1;
        } else {
          break;
        }
      }
    }

    const timeLimitSec = question.timeLimitSec ?? participant.session.quiz.timePerQuestion;

    // Call shared calculateScore
    const { pointsAwarded } = calculateScore({
      isCorrect,
      responseTimeMs,
      timeLimitSec,
      basePoints: question.points,
      pointsMode: participant.session.quiz.pointsMode,
      currentStreak: streak,
      streakBonusEnabled: true,
    });

    // Persist Answer
    await prisma.answer.create({
      data: {
        sessionId: participant.sessionId,
        participantId: participant.id,
        questionId: question.id,
        selectedOptionId: selectedOption.id,
        isCorrect,
        responseTimeMs,
        pointsAwarded,
      },
    });

    // Update Participant accumulated score, and reset start details
    const updatedParticipant = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        finalScore: { increment: pointsAwarded },
        currentQuestionStartedAt: null, // Clear to wait for next-question call
      },
    });

    return res.status(200).json({
      status: 'success',
      data: {
        isCorrect,
        pointsAwarded,
        correctOptionId: correctOption.id,
        explanation: question.explanation,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Move student to the next homework question.
 */
export const advanceHomeworkQuestion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { participantId } = req.params;

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: {
        session: {
          include: {
            quiz: {
              include: {
                questions: {
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
        },
        answers: true,
      },
    });

    if (!participant) {
      throw new AppError('Participant not found', 404);
    }

    if (participant.isCompleted) {
      return res.status(200).json({
        status: 'success',
        data: { completed: true },
      });
    }

    const questions = participant.session.quiz.questions;
    const answeredIds = participant.answers.map(a => a.questionId);

    // Find next unanswered question
    const nextQuestion = questions.find(q => !answeredIds.includes(q.id));

    if (nextQuestion) {
      // Set active question
      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          currentQuestionId: nextQuestion.id,
          currentQuestionStartedAt: new Date(), // Mark question start
        },
      });

      // Load options
      const options = await prisma.option.findMany({
        where: { questionId: nextQuestion.id },
        select: { id: true, text: true },
      });

      return res.status(200).json({
        status: 'success',
        data: {
          completed: false,
          questionIndex: nextQuestion.order,
          totalQuestions: questions.length,
          question: {
            id: nextQuestion.id,
            order: nextQuestion.order,
            text: nextQuestion.text,
            imageUrl: nextQuestion.imageUrl,
            type: nextQuestion.type,
            timeLimitSec: nextQuestion.timeLimitSec ?? participant.session.quiz.timePerQuestion,
            codeSnippet: nextQuestion.codeSnippet,
            codeLanguage: nextQuestion.codeLanguage,
            options,
          },
        },
      });
    } else {
      // Completed homework quiz!
      const correctAnswers = participant.answers.filter(a => a.isCorrect).length;
      const accuracy = participant.answers.length > 0 
        ? Math.round((correctAnswers / participant.answers.length) * 100)
        : 0;

      // Calculate rank amongst completed students
      const higherScoreCount = await prisma.participant.count({
        where: {
          sessionId: participant.sessionId,
          isCompleted: true,
          finalScore: { gt: participant.finalScore },
        },
      });
      const finalRank = higherScoreCount + 1;

      await prisma.participant.update({
        where: { id: participant.id },
        data: {
          isCompleted: true,
          currentQuestionId: null,
          currentQuestionStartedAt: null,
          finalRank,
        },
      });

      return res.status(200).json({
        status: 'success',
        data: {
          completed: true,
          scoreSummary: {
            finalScore: participant.finalScore,
            accuracy,
            totalAnswered: participant.answers.length,
          },
        },
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Fetch all questions, correct options, and explanations for post-session student review.
 */
export const getSessionReviewData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        quiz: {
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }

    if (session.status !== 'ENDED') {
      throw new AppError('Review mode is only available after the session has ended.', 400);
    }

    const quiz = session.quiz;
    const questions = quiz.questions.map((q) => ({
      id: q.id,
      order: q.order,
      text: q.text,
      imageUrl: q.imageUrl,
      type: q.type,
      explanation: q.explanation,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
      options: q.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        isCorrect: opt.isCorrect,
      })),
    }));

    return res.status(200).json({
      status: 'success',
      data: {
        quizTitle: quiz.title,
        questions,
      },
    });
  } catch (error) {
    next(error);
  }
};

