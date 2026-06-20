// Host Authentication Contracts
export interface RegisterRequest {
  email: string;
  passwordHash: string; // Wait, password is sent in plain-text over HTTP, then hashed on server. Let's name it password for the request!
  name: string;
}

export interface RegisterPayload {
  email: string;
  password?: string; // Standard plain text password
  name: string;
}

export interface LoginPayload {
  email: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
  };
}

// Quiz & Settings Contracts
export type PointsMode = 'STANDARD' | 'DOUBLE' | 'NONE';

export interface QuizSettingsDto {
  timePerQuestion: number;
  pointsMode: PointsMode;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showLeaderboardBetweenQuestions: boolean;
  allowLateJoin: boolean;
}

export interface OptionDto {
  id?: string;
  text: string;
  isCorrect: boolean;
}

export interface QuestionDto {
  id?: string;
  order: number;
  text: string;
  imageUrl: string | null;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  timeLimitSec: number | null;
  points: number;
  explanation: string | null;
  options: OptionDto[];
}

export interface QuizDto {
  id: string;
  hostId: string;
  title: string;
  description: string | null;
  settings: QuizSettingsDto;
  questions?: QuestionDto[];
  createdAt: string;
}

export interface CreateQuizPayload {
  title: string;
  description?: string;
  timePerQuestion?: number;
  pointsMode?: PointsMode;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  showLeaderboardBetweenQuestions?: boolean;
  allowLateJoin?: boolean;
}

// Live Session Dashboard Contracts
export interface SessionSummaryDto {
  sessionId: string;
  joinCode: string;
  status: 'LOBBY' | 'LIVE' | 'PAUSED' | 'ENDED';
  mode: 'LIVE' | 'HOMEWORK';
  startedAt: string;
  endedAt: string | null;
  totalParticipants: number;
  completionRate: number;
  averageScore: number;
  averageAccuracy: number;
}

export interface SessionListItemDto {
  sessionId: string;
  joinCode: string;
  status: 'LOBBY' | 'LIVE' | 'PAUSED' | 'ENDED';
  mode: 'LIVE' | 'HOMEWORK';
  startedAt: string;
  endedAt: string | null;
  totalParticipants: number;
  averageScore: number;
  averageAccuracy: number;
}

export interface SessionOverviewDto {
  totalParticipants: number;
  completionRate: number;
  averageScore: number;
  averageAccuracy: number;
  averageResponseTimeSec: number;
  fastestPlayer: {
    displayName: string;
    avgResponseTimeSec: number;
  } | null;
  hardestQuestion: {
    questionText: string;
    order: number;
    accuracy: number;
  } | null;
}

export interface SessionLeaderboardEntryDto {
  rank: number;
  displayName: string;
  score: number;
  accuracy: number;
  avgResponseTimeSec: number;
}

export interface QuestionHeatmapItemDto {
  id: string;
  text: string;
  order: number;
  accuracy: number;
}

export interface QuestionAnalysisDto {
  id: string;
  text: string;
  order: number;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  accuracy: number;
  avgResponseTimeSec: number;
  mostMissed: boolean;
  optionsDistribution: {
    id: string;
    text: string;
    count: number;
    isCorrect: boolean;
  }[];
}

export interface ResponseMatrixQuestionDto {
  id: string;
  order: number;
  text: string;
}

export interface ResponseMatrixCellDto {
  questionId: string;
  isCorrect: boolean | null;
  responseTimeSec: number | null;
  selectedOptionText: string | null;
}

export interface ResponseMatrixRowDto {
  participantId: string;
  displayName: string;
  finalScore: number;
  answers: ResponseMatrixCellDto[];
}

export interface StudentDrilldownDto {
  id: string;
  displayName: string;
  accuracy: number;
  totalQuestionsAnswered: number;
  slowestQuestions: {
    questionText: string;
    responseTimeSec: number;
    isCorrect: boolean;
  }[];
  answers: {
    questionId: string;
    text: string;
    order: number;
    selectedOptionText: string;
    isCorrect: boolean;
    responseTimeSec: number;
    pointsAwarded: number;
  }[];
}

export interface SessionAnalyticsDto {
  joinCode: string;
  mode: 'LIVE' | 'HOMEWORK';
  overview: SessionOverviewDto;
  leaderboard: SessionLeaderboardEntryDto[];
  perQuestion: {
    heatmap: QuestionHeatmapItemDto[];
    questions: QuestionAnalysisDto[];
  };
  responseMatrix: {
    questions: ResponseMatrixQuestionDto[];
    matrix: ResponseMatrixRowDto[];
  };
  participants: StudentDrilldownDto[];
}

export interface HomeworkValidatePayload {
  joinCode: string;
}

export interface HomeworkValidateResponse {
  status: 'success';
  data: {
    valid: boolean;
    mode: 'LIVE' | 'HOMEWORK';
    quizTitle: string;
    homeworkStart: string | null;
    homeworkEnd: string | null;
  };
}

export interface HomeworkJoinPayload {
  joinCode: string;
  displayName: string;
}

export interface HomeworkJoinResponse {
  status: 'success';
  data: {
    participantId: string;
    sessionId: string;
    quizTitle: string;
    totalQuestions: number;
    firstQuestion: {
      id: string;
      order: number;
      text: string;
      imageUrl: string | null;
      type: 'MCQ_SINGLE' | 'TRUE_FALSE';
      timeLimitSec: number;
      options: { id: string; text: string }[];
    } | null;
  };
}

export interface HomeworkQuestionResponse {
  status: 'success';
  data: {
    completed: boolean;
    questionIndex?: number;
    totalQuestions?: number;
    question?: {
      id: string;
      order: number;
      text: string;
      imageUrl: string | null;
      type: 'MCQ_SINGLE' | 'TRUE_FALSE';
      timeLimitSec: number;
      options: { id: string; text: string }[];
    };
    scoreSummary?: {
      finalScore: number;
      accuracy: number;
      totalAnswered: number;
    };
  };
}

export interface HomeworkSubmitAnswerPayload {
  questionId: string;
  optionId: string;
}

export interface HomeworkSubmitAnswerResponse {
  status: 'success';
  data: {
    isCorrect: boolean;
    pointsAwarded: number;
    correctOptionId: string;
    explanation: string | null;
  };
}


