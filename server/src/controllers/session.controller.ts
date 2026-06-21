import { Response, NextFunction } from 'express';
import { prisma } from '../config/db.js';
import { AppError } from '../middleware/error.middleware.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

/**
 * List all past sessions for a quiz with aggregated metrics for session history trends.
 */
export const listSessionsForQuiz = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { quizId } = req.params;
    const hostId = req.user!.id;

    // 1. Verify quiz exists and belongs to host
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new AppError('Quiz not found', 404);
    }
    if (quiz.hostId !== hostId) {
      throw new AppError('Unauthorized access to quiz sessions', 403);
    }

    // 2. Fetch all sessions for this quiz
    const sessions = await prisma.session.findMany({
      where: { quizId },
      orderBy: { startedAt: 'asc' },
    });

    // 3. Fetch aggregations grouped by sessionId
    const participantAggregates = await prisma.participant.groupBy({
      by: ['sessionId'],
      where: { session: { quizId } },
      _count: { id: true },
      _avg: { finalScore: true },
    });

    const answerCountAggregates = await prisma.answer.groupBy({
      by: ['sessionId'],
      where: { session: { quizId } },
      _count: { id: true },
    });

    const correctAnswerCountAggregates = await prisma.answer.groupBy({
      by: ['sessionId'],
      where: { session: { quizId }, isCorrect: true },
      _count: { id: true },
    });

    // 4. Map into SessionListItemDto list
    const sessionHistory = sessions.map((s) => {
      const partAgg = participantAggregates.find((p) => p.sessionId === s.id);
      const ansAgg = answerCountAggregates.find((a) => a.sessionId === s.id);
      const correctAgg = correctAnswerCountAggregates.find((c) => c.sessionId === s.id);

      const totalParticipants = partAgg?._count.id || 0;
      const averageScore = partAgg?._avg.finalScore || 0;

      const totalAnswers = ansAgg?._count.id || 0;
      const totalCorrect = correctAgg?._count.id || 0;
      const averageAccuracy = totalAnswers > 0 ? (totalCorrect / totalAnswers) * 100 : 0;

      return {
        sessionId: s.id,
        joinCode: s.joinCode,
        status: s.status,
        mode: s.mode,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        totalParticipants,
        averageScore: Math.round(averageScore),
        averageAccuracy: Math.round(averageAccuracy),
      };
    });

    return res.status(200).json({
      status: 'success',
      data: { sessions: sessionHistory },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get comprehensive analytics for a specific session.
 */
export const getSessionAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { sessionId } = req.params;
    const hostId = req.user!.id;

    // 1. Verify session exists and belongs to host
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { quiz: true },
    });

    if (!session) {
      throw new AppError('Session not found', 404);
    }
    if (session.quiz.hostId !== hostId) {
      throw new AppError('Unauthorized access to session analytics', 403);
    }

    // 2. Fetch basic counts and averages
    const totalParticipants = await prisma.participant.count({
      where: { sessionId },
    });

    const finalScoreAvg = await prisma.participant.aggregate({
      where: { sessionId },
      _avg: { finalScore: true },
    });

    const answerStats = await prisma.answer.aggregate({
      where: { sessionId },
      _count: { id: true },
      _avg: { responseTimeMs: true },
    });

    const correctAnswersCount = await prisma.answer.count({
      where: { sessionId, isCorrect: true },
    });

    const totalQuestions = await prisma.question.count({
      where: { quizId: session.quizId },
    });

    // 3. Compute KPIs
    const completionRate = (totalParticipants > 0 && totalQuestions > 0)
      ? (answerStats._count.id / (totalParticipants * totalQuestions)) * 100
      : 0;

    const averageAccuracy = answerStats._count.id > 0
      ? (correctAnswersCount / answerStats._count.id) * 100
      : 0;

    const averageResponseTimeSec = (answerStats._avg.responseTimeMs || 0) / 1000;

    // 4. Query fastest player (lowest average response time for correct submissions)
    const fastestPlayerGroup = await prisma.answer.groupBy({
      by: ['participantId'],
      where: { sessionId, isCorrect: true },
      _avg: { responseTimeMs: true },
      orderBy: { _avg: { responseTimeMs: 'asc' } },
      take: 1,
    });

    let fastestPlayer = null;
    if (fastestPlayerGroup.length > 0) {
      const p = await prisma.participant.findUnique({
        where: { id: fastestPlayerGroup[0].participantId },
      });
      if (p) {
        fastestPlayer = {
          displayName: p.displayName,
          avgResponseTimeSec: Math.round(((fastestPlayerGroup[0]._avg.responseTimeMs || 0) / 1000) * 10) / 10,
        };
      }
    }

    // 5. Query question-by-question analysis (option choices distribution)
    const questions = await prisma.question.findMany({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      include: {
        options: {
          include: {
            answers: {
              where: { sessionId },
            },
          },
        },
        answers: {
          where: { sessionId },
        },
      },
    });

    const questionAnalyses = questions.map((q) => {
      const totalAns = q.answers.length;
      const correctAns = q.answers.filter((a) => a.isCorrect).length;
      const accuracy = totalAns > 0 ? (correctAns / totalAns) * 100 : 0;
      const avgResponseTimeSec = totalAns > 0 
        ? (q.answers.reduce((acc, a) => acc + a.responseTimeMs, 0) / totalAns) / 1000 
        : 0;

      return {
        id: q.id,
        text: q.text,
        order: q.order,
        type: q.type,
        accuracy: Math.round(accuracy * 10) / 10,
        avgResponseTimeSec: Math.round(avgResponseTimeSec * 10) / 10,
        mostMissed: false, // Flagged after finding the minimum
        codeSnippet: q.codeSnippet,
        codeLanguage: q.codeLanguage,
        optionsDistribution: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          count: opt.answers.length,
          isCorrect: opt.isCorrect,
        })),
      };
    });

    // 6. Identify hardest question and flag mostMissed
    const answeredQuestions = questionAnalyses.filter((q) => 
      q.optionsDistribution.some((o) => o.count > 0)
    );

    let hardestQuestion = null;
    if (answeredQuestions.length > 0) {
      const minAcc = Math.min(...answeredQuestions.map((q) => q.accuracy));
      questionAnalyses.forEach((q) => {
        if (q.accuracy === minAcc && totalParticipants > 0 && q.optionsDistribution.some((o) => o.count > 0)) {
          q.mostMissed = true;
        }
      });

      const hardest = answeredQuestions.find((q) => q.accuracy === minAcc);
      if (hardest) {
        hardestQuestion = {
          questionText: hardest.text,
          order: hardest.order,
          accuracy: Math.round(hardest.accuracy * 10) / 10,
        };
      }
    }

    const heatmap = questionAnalyses.map((q) => ({
      id: q.id,
      text: q.text,
      order: q.order,
      accuracy: q.accuracy,
    }));

    // 7. Query participants for leaderboard and student reports
    const participants = await prisma.participant.findMany({
      where: { sessionId },
      orderBy: { finalScore: 'desc' },
      include: {
        answers: {
          include: {
            question: true,
            selectedOption: true,
          },
        },
      },
    });

    const leaderboard = participants.map((p, idx) => {
      const totalAns = p.answers.length;
      const correctAns = p.answers.filter((a) => a.isCorrect).length;
      const accuracy = totalAns > 0 ? (correctAns / totalAns) * 100 : 0;
      const avgResponseTimeSec = totalAns > 0 
        ? (p.answers.reduce((acc, a) => acc + a.responseTimeMs, 0) / totalAns) / 1000 
        : 0;

      return {
        rank: p.finalRank || idx + 1,
        displayName: p.displayName,
        score: p.finalScore,
        accuracy: Math.round(accuracy * 10) / 10,
        avgResponseTimeSec: Math.round(avgResponseTimeSec * 10) / 10,
      };
    });

    const participantDrilldowns = participants.map((p) => {
      const totalAns = p.answers.length;
      const correctAns = p.answers.filter((a) => a.isCorrect).length;
      const accuracy = totalAns > 0 ? (correctAns / totalAns) * 100 : 0;

      const pAnswers = p.answers.map((ans) => ({
        questionId: ans.questionId,
        text: ans.question.text,
        order: ans.question.order,
        selectedOptionText: ans.selectedOption ? ans.selectedOption.text : 'Unanswered',
        isCorrect: ans.isCorrect,
        responseTimeSec: Math.round((ans.responseTimeMs / 1000) * 10) / 10,
        pointsAwarded: ans.pointsAwarded,
        earlyBonus: ans.earlyBonus,
        penalty: ans.penalty,
      })).sort((a, b) => a.order - b.order);

      const slowest = [...p.answers]
        .sort((a, b) => b.responseTimeMs - a.responseTimeMs)
        .slice(0, 3)
        .map((ans) => ({
          questionText: ans.question.text,
          responseTimeSec: Math.round((ans.responseTimeMs / 1000) * 10) / 10,
          isCorrect: ans.isCorrect,
        }));

      return {
        id: p.id,
        displayName: p.displayName,
        accuracy: Math.round(accuracy * 10) / 10,
        totalQuestionsAnswered: totalAns,
        slowestQuestions: slowest,
        answers: pAnswers,
      };
    });

    // 8. Build Response Matrix grid
    const matrixQuestions = questionAnalyses.map((q) => ({
      id: q.id,
      order: q.order,
      text: q.text,
    }));

    const matrixRows = participants.map((p) => {
      const cellMap = p.answers.map((ans) => ({
        questionId: ans.questionId,
        isCorrect: ans.isCorrect,
        responseTimeSec: Math.round((ans.responseTimeMs / 1000) * 10) / 10,
        selectedOptionText: ans.selectedOption ? ans.selectedOption.text : 'Unanswered',
        pointsAwarded: ans.pointsAwarded,
        earlyBonus: ans.earlyBonus,
        penalty: ans.penalty,
      }));

      const cellAnswers = matrixQuestions.map((mq) => {
        const match = cellMap.find((c) => c.questionId === mq.id);
        return {
          questionId: mq.id,
          isCorrect: match ? match.isCorrect : null,
          responseTimeSec: match ? match.responseTimeSec : null,
          selectedOptionText: match ? match.selectedOptionText : null,
          pointsAwarded: match ? match.pointsAwarded : null,
          earlyBonus: match ? match.earlyBonus : null,
          penalty: match ? match.penalty : null,
        };
      });

      return {
        participantId: p.id,
        displayName: p.displayName,
        finalScore: p.finalScore,
        answers: cellAnswers,
      };
    });

    return res.status(200).json({
      status: 'success',
      data: {
        quizId: session.quizId,
        quizTitle: session.quiz.title,
        joinCode: session.joinCode,
        mode: session.mode,
        overview: {
          totalParticipants,
          completionRate: Math.round(completionRate * 10) / 10,
          averageScore: Math.round(finalScoreAvg._avg.finalScore || 0),
          averageAccuracy: Math.round(averageAccuracy * 10) / 10,
          averageResponseTimeSec: Math.round(averageResponseTimeSec * 10) / 10,
          fastestPlayer,
          hardestQuestion,
        },
        leaderboard,
        perQuestion: {
          heatmap,
          questions: questionAnalyses,
        },
        responseMatrix: {
          questions: matrixQuestions,
          matrix: matrixRows,
        },
        participants: participantDrilldowns,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Host creates a new homework session for a quiz.
 */
export const createHomeworkSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const { quizId } = req.params;
    const { homeworkStart, homeworkEnd } = req.body;
    const hostId = req.user!.id;

    if (!homeworkStart || !homeworkEnd) {
      throw new AppError('Start and end datetimes are required', 400);
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new AppError('Quiz not found', 404);
    }
    if (quiz.hostId !== hostId) {
      throw new AppError('Unauthorized to create session for this quiz', 403);
    }

    // Generate unique 6-digit code
    let joinCode = Math.floor(100000 + Math.random() * 900000).toString();
    let collision = await prisma.session.findUnique({ where: { joinCode } });
    while (collision) {
      joinCode = Math.floor(100000 + Math.random() * 900000).toString();
      collision = await prisma.session.findUnique({ where: { joinCode } });
    }

    const session = await prisma.session.create({
      data: {
        quizId,
        hostId,
        joinCode,
        status: 'LIVE', // Homework starts active directly
        mode: 'HOMEWORK',
        homeworkStart: new Date(homeworkStart),
        homeworkEnd: new Date(homeworkEnd),
      },
    });

    return res.status(201).json({
      status: 'success',
      data: {
        sessionId: session.id,
        joinCode: session.joinCode,
        mode: session.mode,
        homeworkStart: session.homeworkStart?.toISOString() || null,
        homeworkEnd: session.homeworkEnd?.toISOString() || null,
      },
    });
  } catch (error) {
    next(error);
  }
};

