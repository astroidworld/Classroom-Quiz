import { create } from 'zustand';

interface UserInfo {
  id: string;
  email: string;
  name: string;
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: UserInfo) => void;
  logout: () => void;
  initialize: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: (token, user) => {
    localStorage.setItem('quiz_auth_token', token);
    set({
      token,
      user,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  logout: () => {
    localStorage.removeItem('quiz_auth_token');
    set({
      token: null,
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  initialize: async () => {
    const savedToken = localStorage.getItem('quiz_auth_token');
    if (!savedToken) {
      set({ isLoading: false });
      return;
    }

    try {
      // Validate saved token by calling user profile endpoint
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${savedToken}`,
        },
      });

      if (response.ok) {
        const json = await response.json();
        set({
          token: savedToken,
          user: json.data.user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        // Token is invalid or expired
        localStorage.removeItem('quiz_auth_token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      }
    } catch (error) {
      console.error('Failed to initialize authentication', error);
      // Keep loading states false, but retain token in case it is a network error
      set({ isLoading: false });
    }
  },
}));
