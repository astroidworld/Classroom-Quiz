import { create } from 'zustand';
import { useAuthStore } from './authStore.js';
import { CreateQuizPayload, QuizDto, QuestionDto } from '@classroom-quiz/shared';

interface QuizState {
  quizzes: QuizDto[];
  activeQuiz: QuizDto | null;
  isLoading: boolean;
  error: string | null;

  fetchQuizzes: () => Promise<void>;
  fetchQuiz: (id: string) => Promise<void>;
  createQuiz: (payload: CreateQuizPayload) => Promise<QuizDto>;
  updateQuiz: (id: string, payload: Partial<QuizDto>) => Promise<void>;
  deleteQuiz: (id: string) => Promise<void>;
  
  addQuestion: (quizId: string, payload: Omit<QuestionDto, 'id'>) => Promise<void>;
  updateQuestion: (quizId: string, questionId: string, payload: Partial<QuestionDto>) => Promise<void>;
  deleteQuestion: (quizId: string, questionId: string) => Promise<void>;
  reorderQuestions: (quizId: string, orders: { id: string; order: number }[]) => Promise<void>;
  
  validateImport: (quizId: string, format: 'csv' | 'paste', content: string) => Promise<any>;
  commitImport: (quizId: string, questions: any[]) => Promise<void>;
}

const getAuthHeader = (): Record<string, string> => {
  const token = useAuthStore.getState().token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const useQuizStore = create<QuizState>((set, get) => ({
  quizzes: [],
  activeQuiz: null,
  isLoading: false,
  error: null,

  fetchQuizzes: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/quizzes', {
        headers: getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch quizzes');
      set({ quizzes: data.data.quizzes, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchQuiz: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch(`/api/quizzes/${id}`, {
        headers: getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to fetch quiz details');
      set({ activeQuiz: data.data.quiz, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  createQuiz: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/quizzes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to create quiz');
      
      set((state) => ({
        quizzes: [data.data.quiz, ...state.quizzes],
        isLoading: false,
      }));
      return data.data.quiz;
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  updateQuiz: async (id, payload) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/quizzes/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update quiz');

      set((state) => ({
        quizzes: state.quizzes.map((q) => (q.id === id ? { ...q, ...data.data.quiz } : q)),
        activeQuiz: state.activeQuiz?.id === id ? { ...state.activeQuiz, ...data.data.quiz } : state.activeQuiz,
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  deleteQuiz: async (id) => {
    set({ error: null });
    try {
      const response = await fetch(`/api/quizzes/${id}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete quiz');

      set((state) => ({
        quizzes: state.quizzes.filter((q) => q.id !== id),
        activeQuiz: state.activeQuiz?.id === id ? null : state.activeQuiz,
      }));
    } catch (err: any) {
      set({ error: err.message });
      throw err;
    }
  },

  addQuestion: async (quizId, payload) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to add question');

      // Refresh active quiz state
      const active = get().activeQuiz;
      if (active && active.id === quizId) {
        set({
          activeQuiz: {
            ...active,
            questions: [...(active.questions || []), data.data.question],
          },
        });
      }
    } catch (err: any) {
      throw err;
    }
  },

  updateQuestion: async (quizId, questionId, payload) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions/${questionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to update question');

      const active = get().activeQuiz;
      if (active && active.id === quizId) {
        set({
          activeQuiz: {
            ...active,
            questions: (active.questions || []).map((q) =>
              q.id === questionId ? data.data.question : q
            ),
          },
        });
      }
    } catch (err: any) {
      throw err;
    }
  },

  deleteQuestion: async (quizId, questionId) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions/${questionId}`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete question');

      const active = get().activeQuiz;
      if (active && active.id === quizId) {
        set({
          activeQuiz: {
            ...active,
            questions: (active.questions || []).filter((q) => q.id !== questionId),
          },
        });
      }
    } catch (err: any) {
      throw err;
    }
  },

  reorderQuestions: async (quizId, orders) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/questions/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ orders }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to reorder questions');

      const active = get().activeQuiz;
      if (active && active.id === quizId) {
        // Re-sort questions locally in active state
        const sorted = [...(active.questions || [])].map((q) => {
          const match = orders.find((o) => o.id === q.id);
          return match ? { ...q, order: match.order } : q;
        }).sort((a, b) => a.order - b.order);

        set({
          activeQuiz: {
            ...active,
            questions: sorted,
          },
        });
      }
    } catch (err: any) {
      throw err;
    }
  },

  validateImport: async (quizId, format, content) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/import/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ format, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to validate import');
      return data.data; // Report details
    } catch (err: any) {
      throw err;
    }
  },

  commitImport: async (quizId, questions) => {
    try {
      const response = await fetch(`/api/quizzes/${quizId}/import/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
        body: JSON.stringify({ questions }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to commit import');

      // Refresh active quiz state
      const active = get().activeQuiz;
      if (active && active.id === quizId) {
        set({
          activeQuiz: {
            ...active,
            questions: [...(active.questions || []), ...data.data.questions],
          },
        });
      }
    } catch (err: any) {
      throw err;
    }
  },
}));
