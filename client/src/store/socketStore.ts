import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { ParticipantDto, PlayerQuestionDto, LeaderboardEntryDto } from '@classroom-quiz/shared';
import { playCorrectSound, playIncorrectSound, getMuteState, toggleMute } from '../utils/audio.js';

type ViewState = 'JOIN' | 'LOBBY' | 'PLAY' | 'QUESTION_LOCK' | 'QUESTION_REVEAL' | 'LEADERBOARD' | 'PODIUM';

interface SocketState {
  socket: Socket | null;
  roomCode: string | null;
  participantId: string | null;
  displayName: string | null;
  sessionId: string | null;
  viewState: ViewState;
  
  players: ParticipantDto[];
  activeQuestion: PlayerQuestionDto | null;
  questionIndex: number;
  totalQuestions: number;
  serverStartTs: number | null;
  timeLimitSec: number;
  secondsRemaining: number;
  
  isAnswerLocked: boolean;
  selectedOptionId: string | null;
  correctOptionId: string | null;
  explanation: string | null;
  scoreResult: {
    questionId: string;
    isCorrect: boolean;
    pointsAwarded: number;
    totalScore: number;
    streak: number;
  } | null;

  submissionMode: 'auto' | 'manual';
  isAnswerRevealed: boolean;
  revealPayload: any | null;

  leaderboard: LeaderboardEntryDto[];
  podium: LeaderboardEntryDto[];
  
  isMuted: boolean;
  isReconnecting: boolean;
  error: string | null;

  initializeConnection: () => void;
  joinRoom: (roomCode: string, displayName: string) => void;
  selectAnswer: (optionId: string) => void;
  submitAnswer: (optionId: string | null) => void;
  reconnectSession: (roomCode: string, participantId: string) => void;
  setMute: (mute: boolean) => void;
  resetGame: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => {
  let timerInterval: any = null;
  let revealTimer: any = null;

  const startLocalCountdown = (limitSec: number, startTs: number) => {
    if (timerInterval) clearInterval(timerInterval);

    const updateTimer = () => {
      const elapsedMs = Date.now() - startTs;
      const remainingSec = Math.max(0, Math.round((limitSec * 1000 - elapsedMs) / 1000));
      set({ secondsRemaining: remainingSec });

      if (remainingSec <= 0) {
        clearInterval(timerInterval);
      }
    };

    updateTimer(); // Initial call
    timerInterval = setInterval(updateTimer, 200); // 5 times a second is plenty accurate
  };

  return {
    socket: null,
    roomCode: null,
    participantId: null,
    displayName: null,
    sessionId: null,
    viewState: 'JOIN',
    
    players: [],
    activeQuestion: null,
    questionIndex: 0,
    totalQuestions: 0,
    serverStartTs: null,
    timeLimitSec: 30,
    secondsRemaining: 0,
    
    isAnswerLocked: false,
    selectedOptionId: null,
    correctOptionId: null,
    explanation: null,
    scoreResult: null,

    submissionMode: 'manual',
    isAnswerRevealed: false,
    revealPayload: null,

    leaderboard: [],
    podium: [],
    
    isMuted: getMuteState(),
    isReconnecting: false,
    error: null,

    initializeConnection: () => {
      if (get().socket) return; // Prevent double init

      // Socket connects to origin host. Proxy maps to 5000 in dev, served statically in prod.
      const socketInstance = io({
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        set({ isReconnecting: false, error: null });
        console.log('🔌 Socket connected successfully.');

        // Auto-reconnect flow
        const savedRoom = localStorage.getItem('quiz_room_code');
        const savedPart = localStorage.getItem('quiz_participant_id');
        if (savedRoom && savedPart) {
          console.log(`🔌 Attempting session re-sync for room ${savedRoom}`);
          socketInstance.emit('player:reconnect', { roomCode: savedRoom, participantId: savedPart });
        }
      });

      socketInstance.on('disconnect', () => {
        set({ isReconnecting: true });
        console.warn('🔌 Socket disconnected. Reconnecting...');
      });

      socketInstance.on('connect_error', () => {
        set({ isReconnecting: false, error: 'Could not connect to server.' });
      });

      // Register live engine callbacks
      socketInstance.on('error', (payload: any) => {
        set({ error: payload.message });
      });

      socketInstance.on('player:joined', (payload: any) => {
        const roomCode = payload.roomCode || get().roomCode || '';
        localStorage.setItem('quiz_room_code', roomCode);
        localStorage.setItem('quiz_participant_id', payload.participantId);
        
        set({
          participantId: payload.participantId,
          sessionId: payload.sessionId,
          displayName: payload.displayName,
          roomCode,
          viewState: 'LOBBY',
          error: null,
        });
      });

      socketInstance.on('lobby:update', (payload: any) => {
        set({ players: payload.players });
      });

      socketInstance.on('game:started', () => {
        // Just state update, wait for question:show
      });

      socketInstance.on('question:show', (payload: any) => {
        if (revealTimer) clearTimeout(revealTimer);
        set({
          activeQuestion: payload.question,
          questionIndex: payload.questionIndex,
          totalQuestions: payload.totalQuestions,
          serverStartTs: payload.serverStartTs,
          timeLimitSec: payload.timeLimitSec,
          isAnswerLocked: false,
          selectedOptionId: null,
          correctOptionId: null,
          explanation: null,
          scoreResult: null,
          submissionMode: payload.submissionMode || 'manual',
          isAnswerRevealed: false,
          revealPayload: null,
          viewState: 'PLAY',
          error: null,
        });
        
        startLocalCountdown(payload.timeLimitSec, payload.serverStartTs);
      });

      socketInstance.on('question:lock', (payload: any) => {
        if (timerInterval) clearInterval(timerInterval);
        set({
          viewState: 'QUESTION_LOCK',
          secondsRemaining: 0,
        });
      });

      socketInstance.on('question:reveal', (payload: any) => {
        if (revealTimer) clearTimeout(revealTimer);
        
        set({
          isAnswerRevealed: true,
          revealPayload: payload,
          viewState: 'QUESTION_REVEAL',
        });

        // Trigger sounds/vibrations based on correctness
        if (payload.isCorrect && !payload.isUnanswered) {
          playCorrectSound();
          if (navigator.vibrate) {
            navigator.vibrate(80);
          }
        } else {
          playIncorrectSound();
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }

        // Auto-transition to leaderboard or waiting
        revealTimer = setTimeout(() => {
          // If scoreboard between questions is enabled, move to scoreboard.
          // Wait, the host will emit leaderboard:update which updates the client's viewState anyway,
          // but we can transition locally to LEADERBOARD or just wait.
          // Let's transition to LEADERBOARD if applicable.
          // Wait, where do we get this setting? We can check payload.showLeaderboardBetweenQuestions (we should make sure the server sends it).
          // Yes, let's assume if the host has it enabled they will broadcast leaderboard:update.
          // We can transition to a wait screen if it's off.
          // To be safe, if we transition locally:
          // If showLeaderboard is false, we stay in a "Waiting" mode.
          // Let's just update the viewState accordingly:
          // if (payload.showLeaderboardBetweenQuestions) viewState -> LEADERBOARD. Else -> QUESTION_LOCK.
          // Wait, let's make sure the server payload has showLeaderboardBetweenQuestions!
          // We'll update the server reveal payload to send it!
          set((state) => ({
            viewState: payload.showLeaderboardBetweenQuestions ? 'LEADERBOARD' : 'QUESTION_LOCK'
          }));
        }, payload.resultScreenDurationMs);
      });

      socketInstance.on('question:reveal:host', (payload: any) => {
        set({
          isAnswerRevealed: true,
          revealPayload: payload,
        });
      });

      socketInstance.on('answer:result', (payload: any) => {
        // Maintained for backward compatibility (e.g. homework/legacy paths)
        set({
          scoreResult: {
            questionId: payload.questionId,
            isCorrect: payload.isCorrect,
            pointsAwarded: payload.pointsAwarded,
            totalScore: payload.totalScore,
            streak: payload.streak,
          },
        });
      });

      socketInstance.on('leaderboard:update', (payload: any) => {
        // Don't transition immediately if we are currently showing a reveal screen!
        // The reveal screen auto-transitions to leaderboard when its timer expires.
        const currentViewState = get().viewState;
        if (currentViewState !== 'QUESTION_REVEAL') {
          set({ 
            leaderboard: payload.leaderboard,
            viewState: 'LEADERBOARD' 
          });
        } else {
          // Just save the leaderboard data for later
          set({ leaderboard: payload.leaderboard });
        }
      });

      socketInstance.on('session:ended', (payload: any) => {
        if (timerInterval) clearInterval(timerInterval);
        if (revealTimer) clearTimeout(revealTimer);
        
        localStorage.removeItem('quiz_room_code');
        localStorage.removeItem('quiz_participant_id');
        
        set({
          podium: payload.podium,
          viewState: 'PODIUM',
        });
      });

      socketInstance.on('session:sync', (payload: any) => {
        if (revealTimer) clearTimeout(revealTimer);

        set({
          viewState: payload.status === 'LOBBY' ? 'LOBBY' : 
                     payload.status === 'ENDED' ? 'PODIUM' : 
                     payload.isAnswerRevealed ? 'QUESTION_REVEAL' :
                     payload.hasAnsweredActiveQuestion ? 'QUESTION_LOCK' : 'PLAY',
          questionIndex: payload.currentQuestionIndex,
          totalQuestions: payload.totalQuestions,
          isAnswerLocked: payload.hasAnsweredActiveQuestion,
          activeQuestion: payload.activeQuestion || null,
          secondsRemaining: payload.secondsRemaining || 0,
          submissionMode: payload.submissionMode || 'manual',
          isAnswerRevealed: payload.isAnswerRevealed || false,
          revealPayload: payload.lastRevealPayload || null,
          error: null,
        });

        if (payload.activeQuestion && payload.secondsRemaining && !payload.hasAnsweredActiveQuestion) {
          const startTs = Date.now() - (payload.activeQuestion.timeLimitSec - payload.secondsRemaining) * 1000;
          startLocalCountdown(payload.activeQuestion.timeLimitSec, startTs);
        }

        // If synced into QUESTION_REVEAL, start local countdown timer
        if (payload.isAnswerRevealed && payload.lastRevealPayload) {
          revealTimer = setTimeout(() => {
            set({
              viewState: payload.lastRevealPayload.showLeaderboardBetweenQuestions ? 'LEADERBOARD' : 'QUESTION_LOCK'
            });
          }, payload.lastRevealPayload.resultScreenDurationMs);
        }
      });

      set({ socket: socketInstance });
    },

    joinRoom: (roomCode, displayName) => {
      const socket = get().socket;
      if (!socket) return;
      
      set({ roomCode, error: null });
      socket.emit('player:join', { roomCode, displayName });
    },

    selectAnswer: (optionId) => {
      const { socket, roomCode, activeQuestion, isAnswerLocked, submissionMode } = get();
      if (!socket || !roomCode || !activeQuestion || isAnswerLocked || submissionMode === 'auto') return;

      set({ selectedOptionId: optionId });
      socket.emit('player:select', { roomCode, questionId: activeQuestion.id, optionId });
    },

    submitAnswer: (optionId) => {
      const { socket, roomCode, activeQuestion, isAnswerLocked, selectedOptionId, submissionMode } = get();
      if (!socket || !roomCode || !activeQuestion || isAnswerLocked) return;

      const finalOptionId = optionId || selectedOptionId;
      if (!finalOptionId) return;

      set({ isAnswerLocked: true, selectedOptionId: finalOptionId });
      socket.emit('player:submit', { roomCode, questionId: activeQuestion.id, optionId: finalOptionId });
    },

    reconnectSession: (roomCode, participantId) => {
      const socket = get().socket;
      if (!socket) return;
      socket.emit('player:reconnect', { roomCode, participantId });
    },

    setMute: (mute) => {
      const current = toggleMute();
      set({ isMuted: current });
    },

    resetGame: () => {
      if (timerInterval) clearInterval(timerInterval);
      if (revealTimer) clearTimeout(revealTimer);
      localStorage.removeItem('quiz_room_code');
      localStorage.removeItem('quiz_participant_id');
      set({
        roomCode: null,
        participantId: null,
        displayName: null,
        sessionId: null,
        viewState: 'JOIN',
        players: [],
        activeQuestion: null,
        questionIndex: 0,
        totalQuestions: 0,
        isAnswerLocked: false,
        selectedOptionId: null,
        correctOptionId: null,
        explanation: null,
        scoreResult: null,
        submissionMode: 'manual',
        isAnswerRevealed: false,
        revealPayload: null,
        leaderboard: [],
        podium: [],
        error: null,
      });
    },
  };
});
