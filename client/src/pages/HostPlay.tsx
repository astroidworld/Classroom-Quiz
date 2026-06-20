import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocketStore } from '../store/socketStore.js';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { 
  Users, Play, ShieldAlert, SkipForward, ArrowRight, 
  Trophy, LogOut, CheckCircle2, XCircle, Flame, Star, Medal, Clock 
} from 'lucide-react';

// Accessibility Shape SVGs
const TriangleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white shrink-0">
    <polygon points="12,3 2,21 22,21" />
  </svg>
);

const DiamondIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white shrink-0">
    <polygon points="12,2 2,12 12,22 22,12" />
  </svg>
);

const CircleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white shrink-0">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const SquareIcon = () => (
  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current text-white shrink-0">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const optionStyles = [
  { bg: 'bg-red-500/10 border-red-500/30 text-red-200', iconBg: 'bg-red-500', icon: <TriangleIcon /> },
  { bg: 'bg-blue-500/10 border-blue-500/30 text-blue-200', iconBg: 'bg-blue-500', icon: <DiamondIcon /> },
  { bg: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-200', iconBg: 'bg-yellow-500 text-slate-950', icon: <CircleIcon /> },
  { bg: 'bg-green-500/10 border-green-500/30 text-green-200', iconBg: 'bg-green-500', icon: <SquareIcon /> },
];

export default function HostPlay() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  
  const { 
    socket, roomCode, players, activeQuestion, questionIndex, totalQuestions,
    secondsRemaining, timeLimitSec, correctOptionId, explanation, leaderboard, 
    podium, viewState, error, initializeConnection, resetGame 
  } = useSocketStore();

  useEffect(() => {
    // Reset any previous student session first to prevent reconnect collisions
    resetGame();
    // Initialize connection
    initializeConnection();
  }, [initializeConnection, resetGame]);

  useEffect(() => {
    if (socket && quizId) {
      socket.emit('session:create', { quizId });
    }
  }, [socket, quizId]);

  useEffect(() => {
    if (viewState === 'PODIUM') {
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      // Fire side bursts for 3 seconds
      const duration = 3 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0, y: 0.8 }
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1, y: 0.8 }
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [viewState]);

  useEffect(() => {
    if (viewState === 'LOBBY' && roomCode && qrCanvasRef.current) {
      const url = `${window.location.origin}/?code=${roomCode}`;
      QRCode.toCanvas(qrCanvasRef.current, url, {
        width: 100,
        margin: 1.5,
        color: {
          dark: '#0f172a', // slate-900
          light: '#ffffff'
        }
      }).catch(err => console.error('QR code generation error:', err));
    }
  }, [viewState, roomCode]);

  const handleStartQuiz = () => {
    if (socket && roomCode) {
      socket.emit('session:start', { roomCode });
    }
  };

  const handleSkipQuestion = () => {
    if (socket && roomCode) {
      socket.emit('question:skip', { roomCode });
    }
  };

  const handleNextQuestion = () => {
    if (socket && roomCode) {
      socket.emit('question:next', { roomCode });
    }
  };

  const handleEndQuiz = () => {
    if (socket && roomCode) {
      if (confirm('Are you sure you want to end this quiz session?')) {
        socket.emit('session:end', { roomCode });
      }
    }
  };

  const handleExit = () => {
    resetGame();
    navigate('/host/dashboard');
  };

  // Helper values
  const onlinePlayers = players.filter(p => p.isOnline);
  const answeredPlayers = onlinePlayers.filter(p => p.hasAnsweredActiveQuestion);
  const allAnswered = onlinePlayers.length > 0 && answeredPlayers.length === onlinePlayers.length;

  return (
    <div className="min-h-screen text-white bg-slate-950 flex flex-col justify-between relative">
      {/* Ambient background decoration */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>

      {/* Header */}
      <header className="glass-panel px-6 py-4 flex justify-between items-center z-10 shrink-0">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-500/15 text-indigo-400 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider">
            Host Control Panel
          </span>
          {roomCode && (
            <span className="bg-slate-900 border border-slate-800 text-slate-350 text-xs px-2.5 py-1 rounded-lg font-bold">
              Room: {roomCode}
            </span>
          )}
        </div>

        <button
          onClick={handleExit}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 px-3 py-1.5 bg-slate-900 border border-slate-850 hover:border-red-500/20 rounded-xl transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          End & Exit
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-6 flex flex-col justify-center items-center z-10">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-200 p-4 rounded-xl mb-6 max-w-md w-full flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {(() => {
          switch (viewState) {
            case 'JOIN': // Initializing/Connecting stage
              return (
                <div className="text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-slate-400 font-semibold">Creating live quiz room session...</p>
                </div>
              );

            case 'LOBBY':
              return (
                <div className="w-full max-w-2xl text-center space-y-8 animate-fade-in">
                  <div className="space-y-3">
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider">
                      Join at <span className="text-white font-extrabold underline">{window.location.origin}</span>
                    </p>
                    <h1 className="font-display text-6xl font-black tracking-tight">
                      Room Code: <span className="text-indigo-400 text-glow">{roomCode}</span>
                    </h1>
                  </div>

                  {/* Joined count & Start trigger */}
                  <div className="glass-card p-8 rounded-2xl border-slate-700/60 shadow-glow flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex-1 flex flex-col sm:flex-row items-center justify-between gap-6 w-full">
                      <div className="flex items-center gap-3 text-left">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 shrink-0">
                          <Users className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{onlinePlayers.length} Student{onlinePlayers.length !== 1 && 's'} Joined</h3>
                          <p className="text-xs text-slate-400 font-medium">Waiting for everyone to enter the lobby</p>
                        </div>
                      </div>

                      <button
                        onClick={handleStartQuiz}
                        disabled={onlinePlayers.length === 0}
                        className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:hover:bg-indigo-500 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2 text-sm uppercase tracking-wide shrink-0"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Start Quiz Game
                      </button>
                    </div>

                    <div className="border-t md:border-t-0 md:border-l border-slate-800/80 pt-6 md:pt-0 md:pl-6 flex flex-col items-center shrink-0">
                      <canvas ref={qrCanvasRef} className="rounded-xl overflow-hidden shadow-md border border-slate-800" />
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Scan to Join</span>
                    </div>
                  </div>

                  {/* Joined Players Grid */}
                  <div className="space-y-4 text-left">
                    <h3 className="text-slate-400 text-xs font-black uppercase tracking-wider border-b border-slate-850 pb-2">
                      Connected Classroom Players ({onlinePlayers.length})
                    </h3>
                    {onlinePlayers.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-8">Waiting for students to join...</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {onlinePlayers.map(p => (
                          <div 
                            key={p.id} 
                            className="bg-slate-905 border border-slate-850 p-3 rounded-xl flex items-center gap-2 font-semibold text-sm justify-between shadow-sm"
                          >
                            <span className="truncate">{p.displayName}</span>
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );

            case 'PLAY':
              if (!activeQuestion) return null;
              // Timer percentage
              const timerPercentage = (secondsRemaining / timeLimitSec) * 100;
              const timerColor = secondsRemaining <= 5 ? 'text-red-400' : secondsRemaining <= 10 ? 'text-yellow-400' : 'text-indigo-400';

              return (
                <div className="w-full max-w-4xl space-y-6 animate-fade-in">
                  {/* Top Stats Banner */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel p-4 rounded-xl">
                    <div className="flex items-center gap-3">
                      <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg font-black">
                        QUESTION {questionIndex} OF {totalQuestions}
                      </span>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Submissions Count */}
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Users className="w-4.5 h-4.5 text-slate-400" />
                        <span>Answers: <strong className="text-indigo-400">{answeredPlayers.length}</strong> / {onlinePlayers.length}</span>
                      </div>

                      {/* Timer */}
                      <div className="flex items-center gap-2 font-bold text-sm">
                        <Clock className={`w-4.5 h-4.5 ${timerColor}`} />
                        <span className={timerColor}>{secondsRemaining}s remaining</span>
                      </div>
                    </div>
                  </div>

                  {/* Question Box */}
                  <div className="glass-card p-8 rounded-2xl border-slate-700/50 shadow-glow text-center space-y-6">
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight">
                      {activeQuestion.text}
                    </h2>

                    {activeQuestion.imageUrl && (
                      <div className="w-full max-w-md mx-auto h-48 rounded-xl overflow-hidden border border-slate-800 bg-slate-950/20 flex items-center justify-center">
                        <img src={activeQuestion.imageUrl} alt="Question diagram" className="w-full h-full object-contain" />
                      </div>
                    )}
                  </div>

                  {/* Choices Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeQuestion.options.map((opt, idx) => {
                      const style = optionStyles[idx] || optionStyles[0];
                      return (
                        <div
                          key={opt.id}
                          className={`w-full rounded-2xl border border-slate-800 p-5 flex items-center gap-4 text-left ${style.bg}`}
                        >
                          <div className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}>
                            {style.icon}
                          </div>
                          <span className="font-display font-bold text-lg">
                            {opt.text}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Skip/Lock control */}
                  <div className="flex justify-end pt-4">
                    <button
                      onClick={handleSkipQuestion}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-black py-3 px-6 rounded-xl shadow-md transition-all uppercase tracking-wider flex items-center gap-2"
                    >
                      <SkipForward className="w-4 h-4 fill-current" />
                      Skip Question / Lock Answers
                    </button>
                  </div>
                </div>
              );

            case 'QUESTION_LOCK':
              if (!activeQuestion) return null;
              const correctOption = activeQuestion.options.find(o => o.id === correctOptionId);

              return (
                <div className="w-full max-w-2xl space-y-6 animate-fade-in">
                  <div className="glass-card p-8 rounded-2xl border-slate-700/60 shadow-glow text-center space-y-6">
                    <div className="inline-flex p-3 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <CheckCircle2 className="w-8 h-8" />
                    </div>
                    
                    <div>
                      <h2 className="text-xl text-slate-400 font-bold uppercase tracking-wider mb-2">Correct Answer Revealed</h2>
                      <h1 className="text-3xl font-black text-emerald-400 leading-tight">
                        {correctOption?.text || 'No correct option set'}
                      </h1>
                    </div>

                    {explanation && (
                      <div className="bg-slate-950/40 border border-slate-850 p-5 rounded-xl text-left text-sm leading-relaxed">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-1">Explanation</span>
                        <p className="text-slate-350 font-semibold">{explanation}</p>
                      </div>
                    )}
                  </div>

                  {/* Action Navigation */}
                  <div className="flex justify-between items-center gap-4">
                    <button
                      onClick={handleEndQuiz}
                      className="text-xs text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider"
                    >
                      End Quiz Early
                    </button>

                    <button
                      onClick={handleNextQuestion} // This is next question
                      className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm uppercase tracking-wide"
                    >
                      <span>Show Standings / Next Question</span>
                      <ArrowRight className="w-4.5 h-4.5" />
                    </button>
                  </div>
                </div>
              );

            case 'LEADERBOARD':
              return (
                <div className="w-full max-w-xl space-y-6 animate-fade-in">
                  <div className="glass-card p-8 rounded-2xl shadow-glow text-center space-y-6">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                        <Trophy className="w-6 h-6 fill-current" />
                      </div>
                      <h1 className="font-display text-3xl font-black tracking-tight mt-2 text-glow">Standings</h1>
                    </div>

                    {/* Table */}
                    <div className="border border-slate-850 rounded-xl bg-slate-950/20 divide-y divide-slate-850/60 max-h-80 overflow-y-auto">
                      {leaderboard.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-6">No scores registered yet.</p>
                      ) : (
                        leaderboard.slice(0, 5).map((player) => (
                          <div 
                            key={player.displayName}
                            className="p-4 flex items-center justify-between transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <span className={`w-6 text-center text-xs font-black select-none ${
                                player.rank === 1 ? 'text-yellow-400 text-glow' : player.rank === 2 ? 'text-slate-350' : player.rank === 3 ? 'text-amber-600' : 'text-slate-500'
                              }`}>
                                #{player.rank}
                              </span>
                              <span className="text-sm font-semibold text-white">
                                {player.displayName}
                              </span>
                            </div>

                            <div className="flex items-center gap-4">
                              {player.streak >= 2 && (
                                <div className="flex items-center gap-0.5 text-orange-500 text-xs font-black">
                                  <Flame className="w-4 h-4 fill-orange-500" />
                                  <span>{player.streak}</span>
                                </div>
                              )}
                              <span className="text-sm font-black text-slate-300">
                                {player.score} pts
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center gap-4">
                    <button
                      onClick={handleEndQuiz}
                      className="text-xs text-slate-400 hover:text-red-400 font-bold uppercase tracking-wider"
                    >
                      End Quiz
                    </button>

                    {questionIndex < totalQuestions ? (
                      <button
                        onClick={handleNextQuestion}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm uppercase tracking-wide animate-pulse"
                      >
                        <span>Next Question</span>
                        <ArrowRight className="w-4.5 h-4.5" />
                      </button>
                    ) : (
                      <button
                        onClick={handleEndQuiz}
                        className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3.5 px-6 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm uppercase tracking-wide animate-pulse"
                      >
                        <span>Complete & End Session</span>
                        <Trophy className="w-4.5 h-4.5 text-yellow-400" />
                      </button>
                    )}
                  </div>
                </div>
              );

            case 'PODIUM':
              // Extract top 3
              const firstPlace = podium.find(p => p.rank === 1);
              const secondPlace = podium.find(p => p.rank === 2);
              const thirdPlace = podium.find(p => p.rank === 3);

              return (
                <div className="w-full max-w-2xl text-center space-y-12 animate-fade-in">
                  <header>
                    <span className="bg-indigo-500/15 text-indigo-400 text-xs px-3 py-1 rounded-full font-black uppercase tracking-widest">
                      Quiz Completed
                    </span>
                    <h1 className="font-display text-4xl font-black mt-3 tracking-tight text-glow">Final Podium</h1>
                  </header>

                  <div className="flex items-end justify-center gap-4 sm:gap-8 w-full max-w-md mx-auto h-64 select-none">
                    {/* 2nd Place Column */}
                    {secondPlace && (
                      <div className="flex flex-col items-center flex-1 animate-fade-in [animation-delay:200ms] opacity-0" style={{ animationFillMode: 'forwards' }}>
                        <span className="text-xs font-black truncate max-w-[80px] text-slate-350 mb-1.5">{secondPlace.displayName}</span>
                        <div className="w-full bg-slate-800/80 border border-slate-700/60 rounded-t-2xl flex flex-col items-center justify-center p-3 h-28 shadow-glow">
                          <Medal className="w-7 h-7 text-slate-350 fill-slate-350" />
                          <span className="text-[10px] text-slate-400 font-bold mt-1">2nd Place</span>
                          <span className="text-xs font-black mt-2 text-slate-300">{secondPlace.score}</span>
                        </div>
                      </div>
                    )}

                    {/* 1st Place Column */}
                    {firstPlace && (
                      <div className="flex flex-col items-center flex-1 animate-fade-in opacity-0" style={{ animationFillMode: 'forwards' }}>
                        <span className="text-sm font-black truncate max-w-[100px] text-yellow-400 mb-1.5">{firstPlace.displayName}</span>
                        <div className="w-full bg-indigo-650/30 border border-indigo-500/35 rounded-t-3xl flex flex-col items-center justify-center p-3 h-36 shadow-glow relative">
                          <div className="absolute -top-6 animate-bounce">
                            <Star className="w-8 h-8 text-yellow-400 fill-yellow-400" />
                          </div>
                          <Trophy className="w-8 h-8 text-yellow-400 fill-yellow-400 mt-2" />
                          <span className="text-xs text-yellow-300 font-black mt-1 uppercase tracking-wider">Champion</span>
                          <span className="text-sm font-black mt-2 text-yellow-400">{firstPlace.score}</span>
                        </div>
                      </div>
                    )}

                    {/* 3rd Place Column */}
                    {thirdPlace && (
                      <div className="flex flex-col items-center flex-1 animate-fade-in [animation-delay:400ms] opacity-0" style={{ animationFillMode: 'forwards' }}>
                        <span className="text-xs font-black truncate max-w-[80px] text-amber-600 mb-1.5">{thirdPlace.displayName}</span>
                        <div className="w-full bg-slate-800/80 border border-slate-750/60 rounded-t-xl flex flex-col items-center justify-center p-3 h-20 shadow-glow">
                          <Medal className="w-6 h-6 text-amber-750 fill-amber-750" />
                          <span className="text-[10px] text-slate-550 font-bold mt-1">3rd Place</span>
                          <span className="text-xs font-black mt-1 text-slate-400">{thirdPlace.score}</span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-6 flex gap-4 justify-center">
                    <button
                      onClick={handleExit}
                      className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md text-sm"
                    >
                      Return to Host Dashboard
                    </button>
                    <button
                      onClick={() => {
                        const sId = useSocketStore.getState().sessionId;
                        resetGame();
                        if (sId) {
                          navigate(`/host/sessions/${sId}/analytics`);
                        } else {
                          navigate('/host/dashboard');
                        }
                      }}
                      className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg transform hover:-translate-y-0.5 text-sm uppercase tracking-wider font-display"
                    >
                      Inspect Reports
                    </button>
                  </div>
                </div>
              );

            default:
              return null;
          }
        })()}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-600 shrink-0 select-none">
        Classroom Quiz Live Play Engine © 2026. All rights reserved.
      </footer>
    </div>
  );
}
