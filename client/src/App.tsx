import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuthStore } from './store/authStore.js';
import Login from './pages/Login.js';
import Register from './pages/Register.js';
import QuizList from './pages/QuizList.js';
import QuizEditor from './pages/QuizEditor.js';
import LandingPage from './pages/LandingPage.js';

import { useSocketStore } from './store/socketStore.js';
import JoinRoom from './pages/JoinRoom.js';
import StudentLobby from './pages/StudentLobby.js';
import StudentPlay from './pages/StudentPlay.js';
import StudentLock from './pages/StudentLock.js';
import StudentLeaderboard from './pages/StudentLeaderboard.js';
import StudentPodium from './pages/StudentPodium.js';
import StudentReveal from './pages/StudentReveal.js';

import HostPlay from './pages/HostPlay.js';
import SessionDashboard from './pages/SessionDashboard.js';
import StudentHomeworkPlay from './pages/StudentHomeworkPlay.js';
import StudentReview from './pages/StudentReview.js';

// Protected Route Guard
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Checking credentials...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Public Route Guard (prevents logged in users from visiting login/signup)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/host/dashboard" replace />;
  }

  return <>{children}</>;
};

// Dynamic play wrapper driven by socket viewState
const StudentPlayWrapper = () => {
  const { viewState, isReconnecting } = useSocketStore();

  return (
    <>
      {isReconnecting && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-semibold text-lg text-slate-200">Reconnecting to game room...</p>
          <p className="text-sm text-slate-400 mt-1">Please wait while we restore your session.</p>
        </div>
      )}

      {(() => {
        switch (viewState) {
          case 'JOIN':
            return <JoinRoom />;
          case 'LOBBY':
            return <StudentLobby />;
          case 'PLAY':
            return <StudentPlay />;
          case 'QUESTION_LOCK':
            return <StudentLock />;
          case 'QUESTION_REVEAL':
            return <StudentReveal />;
          case 'LEADERBOARD':
            return <StudentLeaderboard />;
          case 'PODIUM':
            return <StudentPodium />;
          default:
            return <JoinRoom />;
        }
      })()}
    </>
  );
};

export default function App() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<LandingPage />} />
        {/* Student joining flow (public landing) */}
        <Route path="/join" element={<StudentPlayWrapper />} />
        
        {/* Auth routes protected from logged-in hosts */}
        <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

        {/* Host panel (requires authentication) */}
        <Route path="/host/dashboard" element={<ProtectedRoute><QuizList /></ProtectedRoute>} />
        <Route path="/host/quizzes/:quizId/edit" element={<ProtectedRoute><QuizEditor /></ProtectedRoute>} />
        <Route path="/host/play/:quizId" element={<ProtectedRoute><HostPlay /></ProtectedRoute>} />
        <Route path="/host/sessions/:sessionId/analytics" element={<ProtectedRoute><SessionDashboard /></ProtectedRoute>} />
        <Route path="/host/quizzes/:quizId/sessions" element={<ProtectedRoute><SessionDashboard /></ProtectedRoute>} />
        <Route path="/play/homework/:participantId" element={<StudentHomeworkPlay />} />
        <Route path="/play/review/:sessionId" element={<StudentReview />} />

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
