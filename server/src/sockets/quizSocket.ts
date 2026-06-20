import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db.js';
import { sessionManager, LiveSession, MemoryParticipant } from '../services/sessionManager.js';
import { calculateScore } from '../utils/scoring.js';
import { SessionStatus } from '@prisma/client';
import { ClientToServerEvents, ServerToClientEvents } from '@classroom-quiz/shared';

// Utility helper to shuffle an array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function registerQuizHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>) {
  io.on('connection', (socket: Socket) => {
    // -------------------------------------------------------------
    // Student: Join Room
    // -------------------------------------------------------------
    socket.on('player:join', async ({ roomCode, displayName }) => {
      try {
        const name = displayName.trim();
        if (!roomCode || !name) {
          socket.emit('error', { message: 'Room code and display name are required' });
          return;
        }

        const session = sessionManager.getSession(roomCode);
        if (!session) {
          socket.emit('error', { message: 'Active classroom session not found' });
          return;
        }

        if (session.status === SessionStatus.ENDED) {
          socket.emit('error', { message: 'This quiz session has already ended' });
          return;
        }

        // Late Join anti-cheat check
        if (session.status === SessionStatus.LIVE && !session.allowLateJoin) {
          socket.emit('error', { message: 'Late joins are disabled for this session' });
          return;
        }

        let participantId = '';
        const existingPart = session.participants.get(name);

        if (existingPart) {
          if (existingPart.isOnline) {
            socket.emit('error', { message: 'Name is already taken in this room' });
            return;
          } else {
            // Reconnect student
            existingPart.socketId = socket.id;
            existingPart.isOnline = true;
            participantId = existingPart.participantId;

            await prisma.participant.update({
              where: { id: participantId },
              data: { disconnectedAt: null },
            });

            console.log(`🔌 Student ${name} reconnected in room ${roomCode}`);
          }
        } else {
          // New student participant
          const dbPart = await prisma.participant.create({
            data: {
              sessionId: session.sessionId,
              displayName: name,
            },
          });

          participantId = dbPart.id;
          session.participants.set(name, {
            participantId,
            displayName: name,
            socketId: socket.id,
            isOnline: true,
            score: 0,
            streak: 0,
            hasAnsweredActiveQuestion: false,
          });

          console.log(`👤 Student ${name} joined room ${roomCode}`);
        }

        // Join Socket.IO room
        socket.join(roomCode);

        // Acknowledge join success
        socket.emit('player:joined', { 
          participantId, 
          sessionId: session.sessionId, 
          displayName: name 
        });

        // Broadcast lobby list
        io.to(roomCode).emit('lobby:update', { 
          players: Array.from(session.participants.values()).map(p => ({
            id: p.participantId,
            displayName: p.displayName,
            score: p.score,
            streak: p.streak,
            isOnline: p.isOnline,
            hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion
          }))
        });

        // If the quiz is active, synchronize client screen state
        if (session.status === SessionStatus.LIVE && session.currentQuestionIndex > 0) {
          const questions = await prisma.question.findMany({
            where: { quizId: session.quizId },
            orderBy: { order: 'asc' },
            include: { options: true },
          });
          const q = questions[session.currentQuestionIndex - 1];

          // Shuffle option order if enabled
          const optionsDto = q.options.map(o => ({ id: o.id, text: o.text }));
          const shuffledOptions = session.shuffleOptions ? shuffleArray(optionsDto) : optionsDto;

          const playerQuestion = {
            id: q.id,
            text: q.text,
            imageUrl: q.imageUrl,
            type: q.type,
            timeLimitSec: q.timeLimitSec || session.timePerQuestion,
            points: q.points,
            options: shuffledOptions,
          };

          const elapsedMs = session.currentQuestionStartedAt ? (Date.now() - session.currentQuestionStartedAt) : 0;
          const limitMs = playerQuestion.timeLimitSec * 1000;
          const secondsRemaining = Math.max(0, Math.round((limitMs - elapsedMs) / 1000));

          socket.emit('session:sync', {
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: questions.length,
            score: existingPart ? existingPart.score : 0,
            streak: existingPart ? existingPart.streak : 0,
            hasAnsweredActiveQuestion: existingPart ? existingPart.hasAnsweredActiveQuestion : false,
            activeQuestion: playerQuestion,
            secondsRemaining,
          });
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Error occurred joining room' });
      }
    });

    // -------------------------------------------------------------
    // Student: Reconnect explicitly by ID
    // -------------------------------------------------------------
    socket.on('player:reconnect', async ({ roomCode, participantId }) => {
      const session = sessionManager.getSession(roomCode);
      if (!session) {
        socket.emit('error', { message: 'Classroom room not found' });
        return;
      }

      // Find participant in memory
      let name = '';
      for (const [pName, p] of session.participants.entries()) {
        if (p.participantId === participantId) {
          name = pName;
          break;
        }
      }

      if (!name) {
        socket.emit('error', { message: 'Participant not registered in this session' });
        return;
      }

      const p = session.participants.get(name)!;
      p.socketId = socket.id;
      p.isOnline = true;

      await prisma.participant.update({
        where: { id: participantId },
        data: { disconnectedAt: null },
      });

      socket.join(roomCode);
      socket.emit('player:joined', { participantId, sessionId: session.sessionId, displayName: name });

      io.to(roomCode).emit('lobby:update', { 
        players: Array.from(session.participants.values()).map(p => ({
          id: p.participantId,
          displayName: p.displayName,
          score: p.score,
          streak: p.streak,
          isOnline: p.isOnline,
          hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion
        }))
      });

      // Send active sync state
      if (session.status === SessionStatus.LIVE && session.currentQuestionIndex > 0) {
        const questions = await prisma.question.findMany({
          where: { quizId: session.quizId },
          orderBy: { order: 'asc' },
          include: { options: true },
        });
        const q = questions[session.currentQuestionIndex - 1];

        const optionsDto = q.options.map(o => ({ id: o.id, text: o.text }));
        const shuffledOptions = session.shuffleOptions ? shuffleArray(optionsDto) : optionsDto;

        const playerQuestion = {
          id: q.id,
          text: q.text,
          imageUrl: q.imageUrl,
          type: q.type,
          timeLimitSec: q.timeLimitSec || session.timePerQuestion,
          points: q.points,
          options: shuffledOptions,
        };

        const elapsedMs = session.currentQuestionStartedAt ? (Date.now() - session.currentQuestionStartedAt) : 0;
        const limitMs = playerQuestion.timeLimitSec * 1000;
        const secondsRemaining = Math.max(0, Math.round((limitMs - elapsedMs) / 1000));

        socket.emit('session:sync', {
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: questions.length,
          score: p.score,
          streak: p.streak,
          hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion,
          activeQuestion: playerQuestion,
          secondsRemaining,
        });
      }
    });

    // -------------------------------------------------------------
    // Student: Submit Answer
    // -------------------------------------------------------------
    socket.on('player:answer', async ({ roomCode, questionId, optionId }) => {
      try {
        const session = sessionManager.getSession(roomCode);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }

        if (session.status !== SessionStatus.LIVE || !session.currentQuestionStartedAt) {
          socket.emit('error', { message: 'No question is active now' });
          return;
        }

        // Retrieve player displayName from socket
        let displayName = '';
        let participant: MemoryParticipant | null = null;
        for (const [name, p] of session.participants.entries()) {
          if (p.socketId === socket.id) {
            displayName = name;
            participant = p;
            break;
          }
        }

        if (!displayName || !participant) {
          socket.emit('error', { message: 'You are not in this classroom session' });
          return;
        }

        // Anti-cheat: prevent duplicate submits
        if (participant.hasAnsweredActiveQuestion) {
          socket.emit('error', { message: 'Answer already submitted for this question' });
          return;
        }

        const questions = await prisma.question.findMany({
          where: { quizId: session.quizId },
          orderBy: { order: 'asc' },
          include: { options: true },
        });
        const currentQ = questions[session.currentQuestionIndex - 1];

        if (currentQ.id !== questionId) {
          socket.emit('error', { message: 'Invalid question context' });
          return;
        }

        // Server owns the clock
        const answerReceivedTs = Date.now();
        const responseTimeMs = answerReceivedTs - session.currentQuestionStartedAt;
        const timeLimitSec = currentQ.timeLimitSec || session.timePerQuestion;
        
        // Late answers rejected (300ms grace latency buffer)
        const isLate = responseTimeMs > (timeLimitSec * 1000 + 300);
        
        const selectedOption = currentQ.options.find(o => o.id === optionId);
        if (!selectedOption) {
          socket.emit('error', { message: 'Invalid choice selected' });
          return;
        }

        const isCorrect = isLate ? false : selectedOption.isCorrect;

        // Compute points authoritative on server
        if (isCorrect) {
          participant.streak += 1;
        } else {
          participant.streak = 0;
        }

        const { pointsAwarded } = calculateScore({
          isCorrect,
          responseTimeMs,
          timeLimitSec,
          basePoints: currentQ.points,
          pointsMode: session.pointsMode,
          currentStreak: participant.streak,
          streakBonusEnabled: true, // Configured default true for live engine streaks
        });

        participant.score += pointsAwarded;
        participant.hasAnsweredActiveQuestion = true;

        // Persist Answer to DB immediately
        await prisma.answer.create({
          data: {
            sessionId: session.sessionId,
            participantId: participant.participantId,
            questionId,
            selectedOptionId: optionId,
            isCorrect,
            responseTimeMs,
            pointsAwarded,
          },
        });

        // Update score in DB
        await prisma.participant.update({
          where: { id: participant.participantId },
          data: { finalScore: participant.score },
        });

        console.log(`📝 Answer logged for ${displayName}: correct=${isCorrect}, points=${pointsAwarded}`);

        // Broadcast updated lobby (so host dashboard sees answers live)
        io.to(roomCode).emit('lobby:update', { 
          players: Array.from(session.participants.values()).map(p => ({
            id: p.participantId,
            displayName: p.displayName,
            score: p.score,
            streak: p.streak,
            isOnline: p.isOnline,
            hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion
          }))
        });

        // Auto-advance if all connected online players have answered
        const activeOnlinePlayers = Array.from(session.participants.values()).filter(p => p.isOnline);
        const allAnswered = activeOnlinePlayers.every(p => p.hasAnsweredActiveQuestion);

        if (allAnswered && activeOnlinePlayers.length > 0) {
          lockActiveQuestion(roomCode, io, 'ALL_ANSWERED');
        }
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Error saving answer' });
      }
    });

    // -------------------------------------------------------------
    // Host: Create Session
    // -------------------------------------------------------------
    socket.on('session:create', async ({ quizId }) => {
      try {
        // Authenticate - for mock socket we get token or check context. 
        // Real logic: we map host connection to manager. 
        // We'll pass the hostId as hardcoded from database or authenticated
        const user = await prisma.user.findFirst(); // Find first host user as fallback for simple socket auth
        if (!user) {
          socket.emit('error', { message: 'No registered host users found' });
          return;
        }

        const session = await sessionManager.createSession(quizId, user.id, socket.id);
        socket.join(session.joinCode);
        
        socket.emit('player:joined', { 
          participantId: 'host', 
          sessionId: session.sessionId, 
          displayName: user.name,
          roomCode: session.joinCode
        });

        console.log(`🚀 Host created session room code: ${session.joinCode}`);
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to initialize session' });
      }
    });

    // -------------------------------------------------------------
    // Host: Start Quiz Game
    // -------------------------------------------------------------
    socket.on('session:start', async ({ roomCode }) => {
      const session = sessionManager.getSession(roomCode);
      if (!session) {
        socket.emit('error', { message: 'Active session not found' });
        return;
      }

      try {
        session.status = SessionStatus.LIVE;
        session.currentQuestionIndex = 1;

        await prisma.session.update({
          where: { id: session.sessionId },
          data: { status: SessionStatus.LIVE, currentQuestionIndex: 1 },
        });

        io.to(roomCode).emit('game:started');
        console.log(`▶️ Session ${roomCode} started.`);
        
        // Show first question
        sendActiveQuestion(roomCode, io);
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to start session' });
      }
    });

    // -------------------------------------------------------------
    // Host: Skip Timer (Lock question early)
    // -------------------------------------------------------------
    socket.on('question:skip', ({ roomCode }) => {
      const session = sessionManager.getSession(roomCode);
      if (session && session.status === SessionStatus.LIVE) {
        lockActiveQuestion(roomCode, io, 'HOST_SKIPPED');
      }
    });

    // -------------------------------------------------------------
    // Host: Next Question
    // -------------------------------------------------------------
    socket.on('question:next', async ({ roomCode }) => {
      const session = sessionManager.getSession(roomCode);
      if (!session || session.status !== SessionStatus.LIVE) {
        socket.emit('error', { message: 'Session is not active' });
        return;
      }

      const questionsCount = await prisma.question.count({
        where: { quizId: session.quizId },
      });

      if (session.currentQuestionIndex >= questionsCount) {
        socket.emit('error', { message: 'No more questions. Quiz is completed.' });
        return;
      }

      session.currentQuestionIndex += 1;
      await prisma.session.update({
        where: { id: session.sessionId },
        data: { currentQuestionIndex: session.currentQuestionIndex },
      });

      sendActiveQuestion(roomCode, io);
    });

    // -------------------------------------------------------------
    // Host: End Session
    // -------------------------------------------------------------
    socket.on('session:end', async ({ roomCode }) => {
      await endQuizSession(roomCode, io);
    });

    // -------------------------------------------------------------
    // Disconnect event
    // -------------------------------------------------------------
    socket.on('disconnect', async () => {
      // Find if this was a student participant
      const activeSessions = (sessionManager as any).activeSessions as Map<string, LiveSession>;
      for (const [code, session] of activeSessions.entries()) {
        for (const [name, p] of session.participants.entries()) {
          if (p.socketId === socket.id) {
            p.isOnline = false;
            p.socketId = '';
            
            await prisma.participant.update({
              where: { id: p.participantId },
              data: { disconnectedAt: new Date() },
            });

            console.log(`🔌 Student ${name} disconnected from room ${code}`);

            // Broadcast updated lobby
            io.to(code).emit('lobby:update', { 
              players: Array.from(session.participants.values()).map(p => ({
                id: p.participantId,
                displayName: p.displayName,
                score: p.score,
                streak: p.streak,
                isOnline: p.isOnline,
                hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion
              }))
            });

            // Check if all remaining online players have answered
            const online = Array.from(session.participants.values()).filter(x => x.isOnline);
            const allDone = online.every(x => x.hasAnsweredActiveQuestion);
            if (allDone && online.length > 0 && session.status === SessionStatus.LIVE && session.currentQuestionStartedAt) {
              lockActiveQuestion(code, io, 'ALL_ANSWERED');
            }
            return;
          }
        }

        // If it was the host
        if (session.hostSocketId === socket.id) {
          console.log(`🔌 Host disconnected from room ${code}. Gracefully pausing...`);
          // We can pause the session
          session.status = SessionStatus.PAUSED;
          if (session.questionTimer) {
            clearTimeout(session.questionTimer);
          }
          await prisma.session.update({
            where: { id: session.sessionId },
            data: { status: SessionStatus.PAUSED },
          });
          io.to(code).emit('error', { message: 'Host disconnected. The quiz has been paused gracefully.' });
        }
      }
    });
  });
}

/**
 * Helper to emit the current question to the Socket.IO room.
 */
async function sendActiveQuestion(roomCode: string, io: Server<ClientToServerEvents, ServerToClientEvents>) {
  const session = sessionManager.getSession(roomCode);
  if (!session) return;

  try {
    const questions = await prisma.question.findMany({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      include: { options: true },
    });

    const q = questions[session.currentQuestionIndex - 1];
    
    // Shuffle options per broadcast (shuffling for all but keeping optionId authentic for mapping)
    const optionsDto = q.options.map((o) => ({ id: o.id, text: o.text }));
    const shuffledOptions = session.shuffleOptions ? shuffleArray(optionsDto) : optionsDto;

    const timeLimitSec = q.timeLimitSec || session.timePerQuestion;
    const serverStartTs = Date.now();

    session.currentQuestionStartedAt = serverStartTs;
    
    // Clear old timer
    if (session.questionTimer) {
      clearTimeout(session.questionTimer);
    }

    // Set auto-lock timer with 300ms grace latency buffer
    session.questionTimer = setTimeout(() => {
      lockActiveQuestion(roomCode, io, 'TIMEOUT');
    }, timeLimitSec * 1000 + 300);

    // Save active question details to database
    await prisma.session.update({
      where: { id: session.sessionId },
      data: {
        currentQuestionId: q.id,
        currentQuestionStartedAt: new Date(serverStartTs),
      },
    });

    // Reset participant answered flags
    session.participants.forEach((p) => {
      p.hasAnsweredActiveQuestion = false;
    });

    // Broadcast the question show event
    io.to(roomCode).emit('question:show', {
      question: {
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        type: q.type,
        timeLimitSec,
        points: q.points,
        options: shuffledOptions,
      },
      questionIndex: session.currentQuestionIndex,
      totalQuestions: questions.length,
      serverStartTs,
      timeLimitSec,
    });

    console.log(`⏱️ Question ${session.currentQuestionIndex} emitted for room ${roomCode}. Timer set for ${timeLimitSec}s.`);
  } catch (err) {
    console.error('Failed to emit question:', err);
    io.to(roomCode).emit('error', { message: 'Failed to emit next question' });
  }
}

/**
 * Locks the current active question and computes correct options.
 */
async function lockActiveQuestion(
  roomCode: string, 
  io: Server<ClientToServerEvents, ServerToClientEvents>, 
  reason: 'TIMEOUT' | 'ALL_ANSWERED' | 'HOST_SKIPPED'
) {
  const session = sessionManager.getSession(roomCode);
  if (!session || !session.currentQuestionStartedAt) return;

  // Clear timer
  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
    session.questionTimer = null;
  }

  session.currentQuestionStartedAt = null; // Answering locked

  try {
    const questions = await prisma.question.findMany({
      where: { quizId: session.quizId },
      orderBy: { order: 'asc' },
      include: { options: true },
    });
    const currentQ = questions[session.currentQuestionIndex - 1];
    const correctOpt = currentQ.options.find(o => o.isCorrect);
    const correctOptionId = correctOpt ? correctOpt.id : '';

    // Save locking status to DB
    await prisma.session.update({
      where: { id: session.sessionId },
      data: { currentQuestionStartedAt: null },
    });

    // Emit private scores and answers to each student socket
    session.participants.forEach(async (p) => {
      if (!p.socketId) return;

      // Find answer record in DB
      const dbAnswer = await prisma.answer.findFirst({
        where: {
          sessionId: session.sessionId,
          participantId: p.participantId,
          questionId: currentQ.id,
        },
      });

      const pointsAwarded = dbAnswer ? dbAnswer.pointsAwarded : 0;
      const isCorrect = dbAnswer ? dbAnswer.isCorrect : false;

      io.to(p.socketId).emit('answer:result', {
        questionId: currentQ.id,
        isCorrect,
        pointsAwarded,
        totalScore: p.score,
        streak: p.streak,
        correctOptionId,
      });
    });

    // Broadcast question:lock
    io.to(roomCode).emit('question:lock', {
      reason,
      correctOptionId,
      explanation: currentQ.explanation,
    });

    // Calculate leaderboard standings
    const leaderboard = Array.from(session.participants.values())
      .map(p => ({
        displayName: p.displayName,
        score: p.score,
        streak: p.streak,
        isOnline: p.isOnline
      }))
      .sort((a, b) => b.score - a.score);

    const rankedLeaderboard = leaderboard.map((item, idx) => ({
      rank: idx + 1,
      ...item,
    }));

    io.to(roomCode).emit('leaderboard:update', { leaderboard: rankedLeaderboard });
    console.log(`🔒 Question ${session.currentQuestionIndex} locked. Standings broadcasted.`);
  } catch (err) {
    console.error('Failed to lock question:', err);
  }
}

/**
 * Handles completing the session, updating ranks, and broadcasting podiums.
 */
async function endQuizSession(roomCode: string, io: Server<ClientToServerEvents, ServerToClientEvents>) {
  const session = sessionManager.getSession(roomCode);
  if (!session) return;

  if (session.questionTimer) {
    clearTimeout(session.questionTimer);
    session.questionTimer = null;
  }

  try {
    session.status = SessionStatus.ENDED;

    // Fetch final scores, compute rankings
    const leaderboard = Array.from(session.participants.values())
      .map(p => ({
        id: p.participantId,
        displayName: p.displayName,
        score: p.score,
        streak: p.streak,
        isOnline: p.isOnline
      }))
      .sort((a, b) => b.score - a.score);

    // Save final scores, final ranks, and endedAt status in PostgreSQL
    await prisma.$transaction([
      prisma.session.update({
        where: { id: session.sessionId },
        data: { status: SessionStatus.ENDED, endedAt: new Date() },
      }),
      ...leaderboard.map((item, idx) => 
        prisma.participant.update({
          where: { id: item.id },
          data: {
            finalScore: item.score,
            finalRank: idx + 1,
          }
        })
      )
    ]);

    const podium = leaderboard.map((item, idx) => ({
      rank: idx + 1,
      displayName: item.displayName,
      score: item.score,
      streak: item.streak,
      isOnline: item.isOnline,
    }));

    io.to(roomCode).emit('session:ended', { podium });
    console.log(`🏁 Session ${roomCode} ended. Podium results sent.`);

    // Clean memory
    sessionManager.removeSession(roomCode);
  } catch (err) {
    console.error('Failed to end session:', err);
    io.to(roomCode).emit('error', { message: 'Failed to complete quiz session' });
  }
}
