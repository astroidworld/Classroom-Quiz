import { Server, Socket } from 'socket.io';
import { prisma } from '../config/db.js';
import { sessionManager, LiveSession, MemoryParticipant } from '../services/sessionManager.js';
import { calculateScore, calculateQuestionScore } from '../utils/scoring.js';
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

// Helper to get questions in a stable order (shuffled if settings require it)
async function getOrderedQuestions(session: LiveSession) {
  const questions = await prisma.question.findMany({
    where: { quizId: session.quizId },
    orderBy: { order: 'asc' },
    include: { options: true },
  });

  if (session.shuffleQuestions) {
    if (!session.shuffledQuestionIds) {
      const shuffled = [...questions];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      session.shuffledQuestionIds = shuffled.map(q => q.id);
    }
    
    questions.sort((a, b) => {
      const idxA = session.shuffledQuestionIds!.indexOf(a.id);
      const idxB = session.shuffledQuestionIds!.indexOf(b.id);
      return idxA - idxB;
    });
  }

  return questions;
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
          const questions = await getOrderedQuestions(session);
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
            codeSnippet: q.codeSnippet,
            codeLanguage: q.codeLanguage,
            options: shuffledOptions,
          };

          const elapsedMs = session.currentQuestionStartedAt ? (Date.now() - session.currentQuestionStartedAt) : 0;
          const limitMs = playerQuestion.timeLimitSec * 1000;
          const secondsRemaining = Math.max(0, Math.round((limitMs - elapsedMs) / 1000));

          let lastRevealPayload = null;
          if (session.isQuestionRevealed && existingPart) {
            lastRevealPayload = await getStudentRevealPayload(
              session,
              existingPart.participantId,
              existingPart.displayName,
              q,
              limitMs
            );
          }

          socket.emit('session:sync', {
            status: session.status,
            currentQuestionIndex: session.currentQuestionIndex,
            totalQuestions: questions.length,
            score: existingPart ? existingPart.score : 0,
            streak: existingPart ? existingPart.streak : 0,
            hasAnsweredActiveQuestion: existingPart ? existingPart.hasAnsweredActiveQuestion : false,
            activeQuestion: playerQuestion,
            secondsRemaining,
            submissionMode: session.submissionMode,
            isAnswerRevealed: session.isQuestionRevealed,
            lastRevealPayload,
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
        const questions = await getOrderedQuestions(session);
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
          codeSnippet: q.codeSnippet,
          codeLanguage: q.codeLanguage,
          options: shuffledOptions,
        };

        const elapsedMs = session.currentQuestionStartedAt ? (Date.now() - session.currentQuestionStartedAt) : 0;
        const limitMs = playerQuestion.timeLimitSec * 1000;
        const secondsRemaining = Math.max(0, Math.round((limitMs - elapsedMs) / 1000));

        let lastRevealPayload = null;
        if (session.isQuestionRevealed) {
          lastRevealPayload = await getStudentRevealPayload(
            session,
            p.participantId,
            p.displayName,
            q,
            limitMs
          );
        }

        socket.emit('session:sync', {
          status: session.status,
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: questions.length,
          score: p.score,
          streak: p.streak,
          hasAnsweredActiveQuestion: p.hasAnsweredActiveQuestion,
          activeQuestion: playerQuestion,
          secondsRemaining,
          submissionMode: session.submissionMode,
          isAnswerRevealed: session.isQuestionRevealed,
          lastRevealPayload,
        });
      }
    });

    // -------------------------------------------------------------
    // -------------------------------------------------------------
    // Student: Select option transiently (manual mode only)
    // -------------------------------------------------------------
    socket.on('player:select', ({ roomCode, questionId, optionId }) => {
      try {
        const session = sessionManager.getSession(roomCode);
        if (!session || session.status !== SessionStatus.LIVE) return;

        if (session.submissionMode === 'auto') {
          return;
        }

        let participant: MemoryParticipant | null = null;
        for (const [_, p] of session.participants.entries()) {
          if (p.socketId === socket.id) {
            participant = p;
            break;
          }
        }

        if (!participant || participant.hasAnsweredActiveQuestion) return;

        session.playerSelections.set(participant.participantId, optionId);
      } catch (err) {
        console.error('Error in player:select:', err);
      }
    });

    // -------------------------------------------------------------
    // Student: Submit Answer (locks option)
    // -------------------------------------------------------------
    socket.on('player:submit', async ({ roomCode, questionId, optionId }) => {
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

        const questions = await getOrderedQuestions(session);
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

        participant.hasAnsweredActiveQuestion = true;

        // Persist Answer to DB immediately (score/points awarded are 0 initially)
        await prisma.answer.create({
          data: {
            sessionId: session.sessionId,
            participantId: participant.participantId,
            questionId,
            selectedOptionId: optionId,
            isCorrect,
            responseTimeMs,
            pointsAwarded: 0,
            autoSubmitted: false,
            earlyBonus: 0,
            penalty: 0,
          },
        });

        console.log(`📝 Answer submitted for ${displayName}: option=${optionId}, isCorrect=${isCorrect}`);

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
    // Host: Reveal Answer
    // -------------------------------------------------------------
    socket.on('question:reveal:request', async ({ roomCode }) => {
      try {
        const session = sessionManager.getSession(roomCode);
        if (!session) {
          socket.emit('error', { message: 'Session not found' });
          return;
        }
        if (session.status !== SessionStatus.LIVE) {
          socket.emit('error', { message: 'Session is not active' });
          return;
        }
        // Reveal and score answers
        await revealActiveQuestion(roomCode, io);
      } catch (err: any) {
        socket.emit('error', { message: err.message || 'Failed to reveal answers' });
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
    const questions = await getOrderedQuestions(session);

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

    // Reset participant answered flags and selections
    session.participants.forEach((p) => {
      p.hasAnsweredActiveQuestion = false;
    });
    session.playerSelections.clear();
    session.isQuestionRevealed = false;

    // Broadcast the question show event
    io.to(roomCode).emit('question:show', {
      question: {
        id: q.id,
        text: q.text,
        imageUrl: q.imageUrl,
        type: q.type,
        timeLimitSec,
        points: q.points,
        codeSnippet: q.codeSnippet,
        codeLanguage: q.codeLanguage,
        options: shuffledOptions,
      },
      questionIndex: session.currentQuestionIndex,
      totalQuestions: questions.length,
      serverStartTs,
      timeLimitSec,
      submissionMode: session.submissionMode,
    });

    console.log(`⏱️ Question ${session.currentQuestionIndex} emitted for room ${roomCode}. Timer set for ${timeLimitSec}s.`);
  } catch (err) {
    console.error('Failed to emit question:', err);
    io.to(roomCode).emit('error', { message: 'Failed to emit next question' });
  }
}

/**
 * Locks the current active question, runs auto-submit sweep, and broadcasts lock.
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
    const questions = await getOrderedQuestions(session);
    const currentQ = questions[session.currentQuestionIndex - 1];
    const timeLimitSec = currentQ.timeLimitSec || session.timePerQuestion;
    const timeLimitMs = timeLimitSec * 1000;

    // Save locking status to DB
    await prisma.session.update({
      where: { id: session.sessionId },
      data: { currentQuestionStartedAt: null },
    });

    // Run auto-submit sweep
    for (const [_, p] of session.participants.entries()) {
      if (p.hasAnsweredActiveQuestion) continue;

      let selectedOptionId: string | null = null;
      let isCorrect = false;

      if (session.submissionMode === 'manual') {
        const selection = session.playerSelections.get(p.participantId);
        if (selection) {
          selectedOptionId = selection;
          const opt = currentQ.options.find(o => o.id === selection);
          isCorrect = opt ? opt.isCorrect : false;
        }
      }

      await prisma.answer.create({
        data: {
          sessionId: session.sessionId,
          participantId: p.participantId,
          questionId: currentQ.id,
          selectedOptionId,
          isCorrect,
          responseTimeMs: timeLimitMs,
          pointsAwarded: 0,
          autoSubmitted: true,
          earlyBonus: 0,
          penalty: 0,
        },
      });

      p.hasAnsweredActiveQuestion = true;
    }

    // Broadcast question:lock (no correct answer / points revealed yet)
    io.to(roomCode).emit('question:lock', { reason });
    console.log(`🔒 Question ${session.currentQuestionIndex} locked. Auto-submit sweep complete.`);
  } catch (err) {
    console.error('Failed to lock question:', err);
  }
}

/**
 * Computes scores, updates standings, and emits reveals to clients.
 */
async function revealActiveQuestion(
  roomCode: string,
  io: Server<ClientToServerEvents, ServerToClientEvents>
) {
  const session = sessionManager.getSession(roomCode);
  if (!session || session.isQuestionRevealed) return;

  try {
    const questions = await getOrderedQuestions(session);
    const currentQ = questions[session.currentQuestionIndex - 1];
    const correctOpt = currentQ.options.find(o => o.isCorrect);
    const correctOptionId = correctOpt ? correctOpt.id : '';
    const timeLimitSec = currentQ.timeLimitSec || session.timePerQuestion;
    const timeLimitMs = timeLimitSec * 1000;

    // Fetch all Answers for current question
    const dbAnswers = await prisma.answer.findMany({
      where: {
        sessionId: session.sessionId,
        questionId: currentQ.id,
      },
    });

    const studentResults: any[] = [];
    const participantsList = Array.from(session.participants.values());

    for (const p of participantsList) {
      let dbAnswer = dbAnswers.find(a => a.participantId === p.participantId);

      // Fallback in case sweep failed
      if (!dbAnswer) {
        dbAnswer = await prisma.answer.create({
          data: {
            sessionId: session.sessionId,
            participantId: p.participantId,
            questionId: currentQ.id,
            selectedOptionId: null,
            isCorrect: false,
            responseTimeMs: timeLimitMs,
            pointsAwarded: 0,
            autoSubmitted: true,
            earlyBonus: 0,
            penalty: 0,
          },
        });
      }

      const scoreResult = calculateQuestionScore({
        isCorrect: dbAnswer.isCorrect,
        isUnanswered: dbAnswer.selectedOptionId === null,
        basePoints: currentQ.points,
        responseTimeMs: dbAnswer.responseTimeMs,
        timeLimitMs,
        earlySubmitBonus: {
          enabled: session.earlySubmitBonus.enabled,
          maxBonusPoints: session.earlySubmitBonus.maxBonusPoints,
        },
        negativeMarking: {
          enabled: session.negativeMarking.enabled,
          mode: session.negativeMarking.mode,
          value: session.negativeMarking.value,
        },
      });

      // Update streaks
      if (dbAnswer.isCorrect && dbAnswer.selectedOptionId !== null) {
        p.streak += 1;
      } else {
        p.streak = 0;
      }

      // Update participant score in memory
      p.score += scoreResult.total;

      // Update Answer in DB
      await prisma.answer.update({
        where: { id: dbAnswer.id },
        data: {
          pointsAwarded: scoreResult.total,
          earlyBonus: scoreResult.earlyBonus,
          penalty: scoreResult.penalty,
        },
      });

      // Update Participant score in DB
      await prisma.participant.update({
        where: { id: p.participantId },
        data: { finalScore: p.score },
      });

      studentResults.push({
        participantId: p.participantId,
        displayName: p.displayName,
        selectedOptionId: dbAnswer.selectedOptionId,
        isCorrect: dbAnswer.isCorrect,
        autoSubmitted: dbAnswer.autoSubmitted,
        pointsAwarded: scoreResult.total,
        earlyBonus: scoreResult.earlyBonus,
        penalty: scoreResult.penalty,
        responseTimeMs: dbAnswer.responseTimeMs,
        newTotalScore: p.score,
        newRank: 1, // Will be updated after sorting
      });
    }

    // Sort to assign new ranks
    const sortedParticipants = [...participantsList].sort((a, b) => b.score - a.score);

    // Assign ranks in participant DB
    await prisma.$transaction(
      sortedParticipants.map((p, idx) => 
        prisma.participant.update({
          where: { id: p.participantId },
          data: { finalRank: idx + 1 }
        })
      )
    );

    // Update ranks in studentResults
    studentResults.forEach(res => {
      const idx = sortedParticipants.findIndex(p => p.participantId === res.participantId);
      res.newRank = idx + 1;
    });

    session.isQuestionRevealed = true;

    // Calculate options distribution
    const optionDistribution = currentQ.options.map(opt => {
      const count = dbAnswers.filter(a => a.selectedOptionId === opt.id).length;
      return {
        optionId: opt.id,
        optionText: opt.text,
        count,
        isCorrect: opt.isCorrect,
      };
    });

    const correctCount = dbAnswers.filter(a => a.isCorrect && a.selectedOptionId !== null).length;
    const incorrectCount = dbAnswers.filter(a => !a.isCorrect && a.selectedOptionId !== null).length;
    const unansweredCount = dbAnswers.filter(a => a.selectedOptionId === null).length;
    const totalCount = dbAnswers.length;

    const answered = dbAnswers.filter(a => a.selectedOptionId !== null);
    const averageResponseTimeMs = answered.length > 0
      ? Math.round(answered.reduce((acc, curr) => acc + curr.responseTimeMs, 0) / answered.length)
      : 0;

    const totalEarlyBonusAwarded = studentResults.reduce((acc, curr) => acc + curr.earlyBonus, 0);
    const totalPenaltyDeducted = studentResults.reduce((acc, curr) => acc + curr.penalty, 0);

    const correctAnswers = dbAnswers.filter(a => a.isCorrect && a.selectedOptionId !== null);
    const minResponseTime = correctAnswers.length > 0
      ? Math.min(...correctAnswers.map(a => a.responseTimeMs))
      : -1;

    // Emit Personalized Payload to each Student Socket
    studentResults.forEach(res => {
      const p = session.participants.get(res.displayName);
      if (p && p.socketId) {
        const isCorrect = res.isCorrect && res.selectedOptionId !== null;
        const screenSec = isCorrect
          ? session.resultScreenDuration.correctSec
          : session.resultScreenDuration.incorrectSec;

        const isFastest = isCorrect && res.responseTimeMs === minResponseTime;

        io.to(p.socketId).emit('question:reveal', {
          questionId: currentQ.id,
          questionText: currentQ.text,
          correctOptionId,
          allOptions: currentQ.options.map(o => ({ id: o.id, text: o.text })),
          selectedOptionId: res.selectedOptionId,
          isCorrect: res.isCorrect,
          isUnanswered: res.selectedOptionId === null,
          autoSubmitted: res.autoSubmitted,
          pointsAwarded: res.pointsAwarded,
          earlyBonusAwarded: res.earlyBonus,
          negativePenalty: res.penalty,
          responseTimeMs: res.responseTimeMs,
          newTotalScore: res.newTotalScore,
          newRank: res.newRank,
          totalParticipants: sortedParticipants.length,
          resultScreenDurationMs: screenSec * 1000,
          isFastest,
          showLeaderboardBetweenQuestions: session.showLeaderboardBetweenQuestions,
        });
      }
    });

    // Emit Aggregate Payload to Host
    if (session.hostSocketId) {
      io.to(session.hostSocketId).emit('question:reveal:host', {
        questionId: currentQ.id,
        correctOptionId,
        optionDistribution,
        correctCount,
        incorrectCount,
        unansweredCount,
        totalCount,
        averageResponseTimeMs,
        totalEarlyBonusAwarded,
        totalPenaltyDeducted,
        studentResults,
      });
    }

    // Broadcast leaderboard:update to all clients
    const rankedLeaderboard = sortedParticipants.map((p, idx) => {
      const res = studentResults.find(r => r.displayName === p.displayName);
      const pointsChange = res ? res.pointsAwarded : 0;
      return {
        rank: idx + 1,
        displayName: p.displayName,
        score: p.score,
        streak: p.streak,
        isOnline: p.isOnline,
        pointsChange,
      };
    });
    io.to(roomCode).emit('leaderboard:update', { leaderboard: rankedLeaderboard });

    console.log(`🔓 Question ${session.currentQuestionIndex} answers revealed and scored.`);
  } catch (err) {
    console.error('Failed to reveal question answers:', err);
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

/**
 * Constructs the reveal payload for a student on reconnection.
 */
async function getStudentRevealPayload(
  session: LiveSession,
  participantId: string,
  displayName: string,
  currentQ: any,
  timeLimitMs: number
) {
  const dbAnswer = await prisma.answer.findFirst({
    where: {
      sessionId: session.sessionId,
      participantId,
      questionId: currentQ.id,
    },
  });

  if (!dbAnswer) return null;

  const scoreResult = calculateQuestionScore({
    isCorrect: dbAnswer.isCorrect,
    isUnanswered: dbAnswer.selectedOptionId === null,
    basePoints: currentQ.points,
    responseTimeMs: dbAnswer.responseTimeMs,
    timeLimitMs,
    earlySubmitBonus: {
      enabled: session.earlySubmitBonus.enabled,
      maxBonusPoints: session.earlySubmitBonus.maxBonusPoints,
    },
    negativeMarking: {
      enabled: session.negativeMarking.enabled,
      mode: session.negativeMarking.mode,
      value: session.negativeMarking.value,
    },
  });

  const correctOpt = currentQ.options.find((o: any) => o.isCorrect);
  const correctOptionId = correctOpt ? correctOpt.id : '';
  const totalParticipants = session.participants.size;

  const sortedParticipants = Array.from(session.participants.values()).sort((a, b) => b.score - a.score);
  const rankIdx = sortedParticipants.findIndex(p => p.participantId === participantId);
  const newRank = rankIdx !== -1 ? rankIdx + 1 : 1;

  const screenSec = dbAnswer.isCorrect && dbAnswer.selectedOptionId !== null
    ? session.resultScreenDuration.correctSec
    : session.resultScreenDuration.incorrectSec;

  const dbAnswers = await prisma.answer.findMany({
    where: {
      sessionId: session.sessionId,
      questionId: currentQ.id,
    },
  });
  const correctAnswers = dbAnswers.filter(a => a.isCorrect && a.selectedOptionId !== null);
  const minResponseTime = correctAnswers.length > 0
    ? Math.min(...correctAnswers.map(a => a.responseTimeMs))
    : -1;
  const isFastest = dbAnswer.isCorrect && dbAnswer.selectedOptionId !== null && dbAnswer.responseTimeMs === minResponseTime;

  return {
    questionId: currentQ.id,
    questionText: currentQ.text,
    correctOptionId,
    allOptions: currentQ.options.map((o: any) => ({ id: o.id, text: o.text })),
    selectedOptionId: dbAnswer.selectedOptionId,
    isCorrect: dbAnswer.isCorrect,
    isUnanswered: dbAnswer.selectedOptionId === null,
    autoSubmitted: dbAnswer.autoSubmitted,
    pointsAwarded: dbAnswer.pointsAwarded || scoreResult.total,
    earlyBonusAwarded: dbAnswer.earlyBonus || scoreResult.earlyBonus,
    negativePenalty: dbAnswer.penalty || scoreResult.penalty,
    responseTimeMs: dbAnswer.responseTimeMs,
    newTotalScore: session.participants.get(displayName)?.score || 0,
    newRank,
    totalParticipants,
    resultScreenDurationMs: screenSec * 1000,
    isFastest,
    showLeaderboardBetweenQuestions: session.showLeaderboardBetweenQuestions,
  };
}
