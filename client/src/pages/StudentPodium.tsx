import React, { useEffect } from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { Trophy, RefreshCw, Star, Medal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';

export default function StudentPodium() {
  const { podium, displayName, resetGame, sessionId } = useSocketStore();
  const navigate = useNavigate();

  useEffect(() => {
    // Fire center burst
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
  }, []);

  // Find user's own ranking details
  const myResult = podium.find(p => p.displayName === displayName);

  // Extract top 3
  const firstPlace = podium.find(p => p.rank === 1);
  const secondPlace = podium.find(p => p.rank === 2);
  const thirdPlace = podium.find(p => p.rank === 3);

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 text-white max-w-4xl mx-auto w-full relative">
      {/* Background ambient lighting */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-indigo-900/10 via-slate-950 to-slate-950"></div>

      <header className="text-center py-6">
        <span className="bg-indigo-500/15 text-indigo-400 text-xs px-3 py-1 rounded-full font-black uppercase tracking-widest">
          Quiz Completed
        </span>
        <h1 className="font-display text-4xl font-extrabold mt-3 tracking-tight text-glow">Final Podium</h1>
      </header>

      {/* 3D-style Podium Standings */}
      <main className="flex-1 flex flex-col justify-center items-center my-6 space-y-12">
        <div className="flex items-end justify-center gap-4 sm:gap-8 w-full max-w-md h-64 select-none">
          {/* 2nd Place Column */}
          {secondPlace && (
            <div className="flex flex-col items-center flex-1 animate-fade-in [animation-delay:200ms] opacity-0" style={{ animationFillMode: 'forwards' }}>
              <span className="text-xs font-black truncate max-w-[80px] text-slate-300 mb-1.5">{secondPlace.displayName}</span>
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
                <Medal className="w-6 h-6 text-amber-700 fill-amber-700" />
                <span className="text-[10px] text-slate-500 font-bold mt-1">3rd Place</span>
                <span className="text-xs font-black mt-1 text-slate-400">{thirdPlace.score}</span>
              </div>
            </div>
          )}
        </div>

        {/* Participant scorecard summary */}
        {myResult && (
          <div className="glass-card w-full max-w-md p-6 rounded-2xl border-indigo-500/25 shadow-glow text-center space-y-4 animate-fade-in [animation-delay:600ms] opacity-0" style={{ animationFillMode: 'forwards' }}>
            <h3 className="font-display font-black text-lg text-indigo-400">Your Scorecard</h3>
            <div className="grid grid-cols-2 gap-4 divide-x divide-slate-850">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Final Rank</span>
                <span className="text-2xl font-black text-white">#{myResult.rank}</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Points</span>
                <span className="text-2xl font-black text-indigo-400">{myResult.score} pts</span>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="py-6 flex justify-center gap-4 w-full">
        {sessionId && (
          <button
            onClick={() => {
              navigate(`/play/review/${sessionId}`);
              resetGame();
            }}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm shadow-md"
          >
            Review Questions
          </button>
        )}
        <button
          onClick={resetGame}
          className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Exit Room
        </button>
      </footer>
    </div>
  );
}
