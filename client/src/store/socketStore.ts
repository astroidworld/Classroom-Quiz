import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { ParticipantDto, PlayerQuestionDto, LeaderboardEntryDto } from '@classroom-quiz/shared';
import { playCorrectSound, playIncorrectSound, getMuteState, toggleMute } from '../utils/audio.js';

type ViewState = 'JOIN' | 'LOBBY' | 'PLAY' | 'QUESTION_LOCK' | 'LEADERBOARD' | 'PODIUM';

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

  leaderboard: LeaderboardEntryDto[];
  podium: LeaderboardEntryDto[];
  
  isMuted: boolean;
  isReconnecting: boolean;
  error: string | null;

  initializeConnection: () => void;
  joinRoom: (roomCode: string, displayName: string) => void;
  submitAnswer: (optionId: string) => void;
  reconnectSession: (roomCode: string, participantId: string) => void;
  setMute: (mute: boolean) => void;
  resetGame: () => void;
}

export const useSocketStore = create<SocketState>((set, get) => {
  let timerInterval: any = null;

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
          viewState: 'PLAY',
          error: null,
        });
        
        startLocalCountdown(payload.timeLimitSec, payload.serverStartTs);
      });

      socketInstance.on('question:lock', (payload: any) => {
        if (timerInterval) clearInterval(timerInterval);
        set({
          correctOptionId: payload.correctOptionId,
          explanation: payload.explanation,
          viewState: 'QUESTION_LOCK',
          secondsRemaining: 0,
        });
      });

      socketInstance.on('answer:result', (payload: any) => {
        set({
          scoreResult: {
            questionId: payload.questionId,
            isCorrect: payload.isCorrect,
            pointsAwarded: payload.pointsAwarded,
            totalScore: payload.totalScore,
            streak: payload.streak,
          },
        });

        // Trigger bells/vibrations based on response correctness
        if (payload.isCorrect) {
          playCorrectSound();
          if (navigator.vibrate) {
            navigator.vibrate(80); // Short pulse on mobile
          }
        } else {
          playIncorrectSound();
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]); // Buzz pulse
          }
        }
      });

      socketInstance.on('leaderboard:update', (payload: any) => {
        set({ 
          leaderboard: payload.leaderboard,
          viewState: 'LEADERBOARD' 
        });
      });

      socketInstance.on('session:ended', (payload: any) => {
        if (timerInterval) clearInterval(timerInterval);
        
        // Remove active local storage entries since quiz is completed
        localStorage.removeItem('quiz_room_code');
        localStorage.removeItem('quiz_participant_id');
        
        set({
          podium: payload.podium,
          viewState: 'PODIUM',
        });
      });

      socketInstance.on('session:sync', (payload: any) => {
        set({
          viewState: payload.status === 'LOBBY' ? 'LOBBY' : 
                     payload.status === 'ENDED' ? 'PODIUM' : 
                     payload.hasAnsweredActiveQuestion ? 'QUESTION_LOCK' : 'PLAY',
          questionIndex: payload.currentQuestionIndex,
          totalQuestions: payload.totalQuestions,
          isAnswerLocked: payload.hasAnsweredActiveQuestion,
          activeQuestion: payload.activeQuestion || null,
          secondsRemaining: payload.secondsRemaining || 0,
          error: null,
        });

        if (payload.activeQuestion && payload.secondsRemaining && !payload.hasAnsweredActiveQuestion) {
          // Restart countdown based on remaining seconds
          const startTs = Date.now() - (payload.activeQuestion.timeLimitSec - payload.secondsRemaining) * 1000;
          startLocalCountdown(payload.activeQuestion.timeLimitSec, startTs);
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

    submitAnswer: (optionId) => {
      const { socket, roomCode, activeQuestion, isAnswerLocked } = get();
      if (!socket || !roomCode || !activeQuestion || isAnswerLocked) return;

      // Optimistically lock answer selection
      set({ isAnswerLocked: true, selectedOptionId: optionId });
      socket.emit('player:answer', { roomCode, questionId: activeQuestion.id, optionId });
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
        leaderboard: [],
        podium: [],
        error: null,
      });
    },
  };
});
