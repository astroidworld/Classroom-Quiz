import { prisma } from '../config/db.js';
import { PointsMode, SessionStatus, SessionMode } from '@prisma/client';

export interface MemoryParticipant {
  participantId: string;
  displayName: string;
  socketId: string;
  isOnline: boolean;
  score: number;
  streak: number;
  hasAnsweredActiveQuestion: boolean;
}

export interface LiveSession {
  sessionId: string;
  quizId: string;
  hostId: string;
  hostSocketId: string;
  joinCode: string;
  status: SessionStatus;
  mode: SessionMode;
  currentQuestionIndex: number;
  currentQuestionStartedAt: number | null; // Epoch timestamp in ms
  timeRemainingSec: number | null;
  questionTimer: NodeJS.Timeout | null;
  
  // Settings copy for fast engine access
  timePerQuestion: number;
  pointsMode: PointsMode;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showLeaderboardBetweenQuestions: boolean;
  allowLateJoin: boolean;

  participants: Map<string, MemoryParticipant>; // Keyed by displayName
}

class SessionManager {
  private activeSessions = new Map<string, LiveSession>(); // Keyed by joinCode

  /**
   * Generates a random 6-digit numeric string for join codes.
   */
  private generateJoinCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Creates a new live session for a quiz.
   */
  async createSession(quizId: string, hostId: string, hostSocketId: string): Promise<LiveSession> {
    // Fetch quiz settings
    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
    });

    if (!quiz) {
      throw new Error('Quiz not found');
    }

    // Generate unique code, check collisions
    let joinCode = this.generateJoinCode();
    let collision = await prisma.session.findUnique({ where: { joinCode } });
    while (collision || this.activeSessions.has(joinCode)) {
      joinCode = this.generateJoinCode();
      collision = await prisma.session.findUnique({ where: { joinCode } });
    }

    // Persist session to database
    const dbSession = await prisma.session.create({
      data: {
        quizId,
        hostId,
        joinCode,
        status: SessionStatus.LOBBY,
        mode: SessionMode.LIVE,
      },
    });

    const liveSession: LiveSession = {
      sessionId: dbSession.id,
      quizId,
      hostId,
      hostSocketId,
      joinCode,
      status: SessionStatus.LOBBY,
      mode: SessionMode.LIVE,
      currentQuestionIndex: 0,
      currentQuestionStartedAt: null,
      timeRemainingSec: null,
      questionTimer: null,
      timePerQuestion: quiz.timePerQuestion,
      pointsMode: quiz.pointsMode,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      showLeaderboardBetweenQuestions: quiz.showLeaderboardBetweenQuestions,
      allowLateJoin: quiz.allowLateJoin,
      participants: new Map(),
    };

    this.activeSessions.set(joinCode, liveSession);
    return liveSession;
  }

  /**
   * Gets an active session from memory.
   */
  getSession(joinCode: string): LiveSession | undefined {
    return this.activeSessions.get(joinCode);
  }

  /**
   * Deletes a session from memory.
   */
  removeSession(joinCode: string) {
    const session = this.activeSessions.get(joinCode);
    if (session) {
      if (session.questionTimer) {
        clearTimeout(session.questionTimer);
      }
      this.activeSessions.delete(joinCode);
    }
  }

  /**
   * Rehydrates an ended/active session from database into memory (useful for host reconnects).
   */
  async rehydrateSession(joinCode: string, hostSocketId: string): Promise<LiveSession | null> {
    const dbSession = await prisma.session.findUnique({
      where: { joinCode },
      include: {
        quiz: true,
        participants: {
          include: {
            answers: true
          }
        }
      }
    });

    if (!dbSession || dbSession.status === SessionStatus.ENDED) {
      return null;
    }

    const quiz = dbSession.quiz;
    const liveSession: LiveSession = {
      sessionId: dbSession.id,
      quizId: dbSession.quizId,
      hostId: dbSession.hostId,
      hostSocketId,
      joinCode,
      status: dbSession.status,
      mode: dbSession.mode,
      currentQuestionIndex: dbSession.currentQuestionIndex,
      currentQuestionStartedAt: dbSession.currentQuestionStartedAt ? dbSession.currentQuestionStartedAt.getTime() : null,
      timeRemainingSec: null,
      questionTimer: null,
      timePerQuestion: quiz.timePerQuestion,
      pointsMode: quiz.pointsMode,
      shuffleQuestions: quiz.shuffleQuestions,
      shuffleOptions: quiz.shuffleOptions,
      showLeaderboardBetweenQuestions: quiz.showLeaderboardBetweenQuestions,
      allowLateJoin: quiz.allowLateJoin,
      participants: new Map(),
    };

    // Load participants and compute their scores and streaks
    dbSession.participants.forEach((p) => {
      // Re-calculate scores and streaks from answers
      const answersSorted = [...p.answers].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
      
      let score = 0;
      let streak = 0;
      answersSorted.forEach((ans) => {
        score += ans.pointsAwarded;
        if (ans.isCorrect) {
          streak += 1;
        } else {
          streak = 0;
        }
      });

      // Check if participant has answered the active question
      const hasAnsweredActive = p.answers.some(ans => ans.questionId === dbSession.currentQuestionId);

      liveSession.participants.set(p.displayName, {
        participantId: p.id,
        displayName: p.displayName,
        socketId: '', // Restored when the player socket joins/reconnects
        isOnline: p.disconnectedAt === null,
        score,
        streak,
        hasAnsweredActiveQuestion: hasAnsweredActive,
      });
    });

    this.activeSessions.set(joinCode, liveSession);
    return liveSession;
  }
}

export const sessionManager = new SessionManager();
