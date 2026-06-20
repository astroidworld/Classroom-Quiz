export interface ParticipantDto {
  id: string;
  displayName: string;
  score: number;
  streak: number;
  isOnline: boolean;
  hasAnsweredActiveQuestion?: boolean;
}

export interface PlayerQuestionDto {
  id: string;
  text: string;
  imageUrl: string | null;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  timeLimitSec: number;
  points: number;
  options: {
    id: string;
    text: string;
  }[];
}

export interface LeaderboardEntryDto {
  rank: number;
  displayName: string;
  score: number;
  streak: number;
  isOnline: boolean;
}

/**
 * Events sent from Client to Server
 */
export interface ClientToServerEvents {
  // Host control events
  'session:create': (payload: { quizId: string }) => void;
  'session:start': (payload: { roomCode: string }) => void;
  'question:next': (payload: { roomCode: string }) => void;
  'question:skip': (payload: { roomCode: string }) => void;
  'session:pause': (payload: { roomCode: string }) => void;
  'session:resume': (payload: { roomCode: string }) => void;
  'session:end': (payload: { roomCode: string }) => void;

  // Student control events
  'player:join': (payload: { roomCode: string; displayName: string }) => void;
  'player:answer': (payload: { roomCode: string; questionId: string; optionId: string }) => void;
  'player:reconnect': (payload: { roomCode: string; participantId: string }) => void;
}

/**
 * Events sent from Server to Client
 */
export interface ServerToClientEvents {
  // General error callback
  'error': (payload: { message: string }) => void;

  // Room / Lobby updates
  'lobby:update': (payload: { players: ParticipantDto[] }) => void;
  'player:joined': (payload: { participantId: string; sessionId: string; displayName: string; roomCode?: string }) => void;
  'game:started': () => void;

  // Question stages
  'question:show': (payload: {
    question: PlayerQuestionDto;
    questionIndex: number;
    totalQuestions: number;
    serverStartTs: number; // Server epoch timestamp in ms
    timeLimitSec: number;
  }) => void;
  'question:lock': (payload: {
    reason: 'TIMEOUT' | 'ALL_ANSWERED' | 'HOST_SKIPPED';
    correctOptionId: string;
    explanation: string | null;
  }) => void;

  // Scoring response
  'answer:result': (payload: {
    questionId: string;
    isCorrect: boolean;
    pointsAwarded: number;
    totalScore: number;
    streak: number;
    correctOptionId: string;
  }) => void;

  // Leaderboards
  'leaderboard:update': (payload: { leaderboard: LeaderboardEntryDto[] }) => void;
  'session:ended': (payload: { podium: LeaderboardEntryDto[] }) => void;

  // Host/Student reconnection sync
  'session:sync': (payload: {
    status: 'LOBBY' | 'LIVE' | 'PAUSED' | 'ENDED';
    currentQuestionIndex: number;
    totalQuestions: number;
    score: number;
    streak: number;
    hasAnsweredActiveQuestion: boolean;
    activeQuestion?: PlayerQuestionDto;
    secondsRemaining?: number;
  }) => void;
}
