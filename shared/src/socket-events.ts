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
  codeSnippet?: string | null;
  codeLanguage?: string | null;
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
  pointsChange?: number;
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
  'question:reveal:request': (payload: { roomCode: string }) => void; // New reveal trigger
  'session:pause': (payload: { roomCode: string }) => void;
  'session:resume': (payload: { roomCode: string }) => void;
  'session:end': (payload: { roomCode: string }) => void;

  // Student control events
  'player:join': (payload: { roomCode: string; displayName: string }) => void;
  'player:select': (payload: { roomCode: string; questionId: string; optionId: string }) => void; // Transient selection (manual mode only)
  'player:submit': (payload: { roomCode: string; questionId: string; optionId: string }) => void; // Locked-in submit (both modes)
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
    submissionMode: 'auto' | 'manual';
  }) => void;

  'question:lock': (payload: {
    reason: 'TIMEOUT' | 'ALL_ANSWERED' | 'HOST_SKIPPED';
  }) => void; // Defer correct answer revealing

  // Reveal moment payloads
  'question:reveal': (payload: {
    questionId: string;
    questionText: string;
    correctOptionId: string;
    allOptions: { id: string; text: string }[];
    selectedOptionId: string | null;
    isCorrect: boolean;
    isUnanswered: boolean;
    autoSubmitted: boolean;
    pointsAwarded: number;
    earlyBonusAwarded: number;
    negativePenalty: number;
    responseTimeMs: number;
    newTotalScore: number;
    newRank: number;
    totalParticipants: number;
    resultScreenDurationMs: number;
    isFastest?: boolean;
    showLeaderboardBetweenQuestions?: boolean;
  }) => void;

  'question:reveal:host': (payload: {
    questionId: string;
    correctOptionId: string;
    optionDistribution: { optionId: string; optionText: string; count: number; isCorrect: boolean }[];
    correctCount: number;
    incorrectCount: number;
    unansweredCount: number;
    totalCount: number;
    averageResponseTimeMs: number;
    totalEarlyBonusAwarded: number;
    totalPenaltyDeducted: number;
    studentResults: {
      participantId: string;
      displayName: string;
      selectedOptionId: string | null;
      isCorrect: boolean;
      autoSubmitted: boolean;
      pointsAwarded: number;
      earlyBonus: number;
      penalty: number;
      responseTimeMs: number;
      newTotalScore: number;
      newRank: number;
    }[];
  }) => void;

  // Scoring response (maintained for backward compatibility/Homework mode if needed)
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
    submissionMode?: 'auto' | 'manual';
    isAnswerRevealed?: boolean;
    lastRevealPayload?: any;
  }) => void;
}
