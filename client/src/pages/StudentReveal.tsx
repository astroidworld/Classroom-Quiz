import React, { useEffect, useState } from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { CheckCircle2, XCircle, Clock, Flame, Zap, Award } from 'lucide-react';
import confetti from 'canvas-confetti';

export default function StudentReveal() {
  const { revealPayload } = useSocketStore();
  const [timeLeft, setTimeLeft] = useState(revealPayload?.resultScreenDurationMs || 3000);

  useEffect(() => {
    if (!revealPayload) return;

    // Trigger Confetti for correct answers
    if (revealPayload.isCorrect && !revealPayload.isUnanswered) {
      confetti({
        particleCount: 140,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#34d399', '#10b981', '#059669', '#fcd34d', '#fbbf24']
      });
    }

    // Local progress countdown
    const duration = revealPayload.resultScreenDurationMs;
    const intervalTime = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalTime;
      setTimeLeft(Math.max(0, duration - elapsed));
      if (elapsed >= duration) {
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [revealPayload]);

  if (!revealPayload) return null;

  const {
    questionText,
    allOptions,
    selectedOptionId,
    correctOptionId,
    isCorrect,
    isUnanswered,
    pointsAwarded,
    earlyBonusAwarded,
    negativePenalty,
    newTotalScore,
    newRank,
    totalParticipants,
    isFastest,
    resultScreenDurationMs
  } = revealPayload;

  const selectedOptText = allOptions.find((o: any) => o.id === selectedOptionId)?.text || '';
  const correctOptText = allOptions.find((o: any) => o.id === correctOptionId)?.text || '';

  const timerPercentage = (timeLeft / resultScreenDurationMs) * 100;

  // Determine state display configurations
  let themeClass = '';
  let accentColor = '';
  let statusTitle = '';
  let statusDesc = '';
  let statusIcon = null;

  if (isUnanswered) {
    themeClass = 'bg-gradient-to-br from-slate-950 via-amber-950 to-slate-950';
    accentColor = 'text-amber-400';
    statusTitle = "Time's Up!";
    statusDesc = "No answer locked in.";
    statusIcon = <Clock className="w-20 h-20 text-amber-400 animate-pulse" />;
  } else if (isCorrect) {
    themeClass = 'bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-950 animate-pulse-slow';
    accentColor = 'text-emerald-400';
    statusTitle = "Correct!";
    statusDesc = "Awesome job!";
    statusIcon = <CheckCircle2 className="w-20 h-20 text-emerald-400 scale-in-bounce" />;
  } else {
    themeClass = 'bg-gradient-to-br from-slate-950 via-rose-950 to-slate-950 animate-shake';
    accentColor = 'text-rose-400';
    statusTitle = "Incorrect";
    statusDesc = "You'll get the next one!";
    statusIcon = <XCircle className="w-20 h-20 text-rose-400" />;
  }

  return (
    <div className={`min-h-screen flex flex-col justify-between text-white p-6 transition-all duration-500 ${themeClass}`}>
      {/* Top Header */}
      <header className="glass-panel rounded-xl px-5 py-3.5 flex justify-between items-center w-full max-w-4xl mx-auto mb-4 border border-slate-800/60">
        <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">
          Question Results
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 uppercase">Next in</span>
          <span className="bg-slate-900 border border-slate-850 px-2 py-0.5 rounded font-black text-xs min-w-8 text-center text-indigo-400">
            {Math.ceil(timeLeft / 1000)}s
          </span>
        </div>
      </header>

      {/* Main Stats Display */}
      <main className="flex-1 flex flex-col justify-center items-center max-w-lg mx-auto w-full space-y-6">
        <div className="glass-card w-full p-8 rounded-3xl border-slate-700/40 flex flex-col items-center gap-6 relative shadow-glow text-center">
          {/* Status Icon */}
          <div className="mb-2 relative">{statusIcon}</div>

          {/* Animated Header */}
          <div className="space-y-1.5">
            <h1 className={`text-4xl sm:text-5xl font-black font-display tracking-tight leading-none ${accentColor}`}>
              {statusTitle}
            </h1>
            <p className="text-slate-400 text-sm font-semibold">{statusDesc}</p>
          </div>

          {/* Points Card */}
          <div className="w-full bg-slate-950/40 border border-slate-850 p-5 rounded-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-900 pb-2">
              <span className="text-xs text-slate-550 font-bold uppercase tracking-wider">Score update</span>
              <span className={`text-2xl font-black ${pointsAwarded > 0 ? 'text-emerald-400' : pointsAwarded < 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                {pointsAwarded > 0 ? `+${pointsAwarded}` : pointsAwarded} pts
              </span>
            </div>
            
            <div className="space-y-1.5 text-xs text-left text-slate-400">
              {isCorrect && !isUnanswered && (
                <div className="flex justify-between">
                  <span>Speed-weighted Base:</span>
                  <span className="font-bold text-slate-200">+{pointsAwarded - earlyBonusAwarded}</span>
                </div>
              )}
              {earlyBonusAwarded > 0 && (
                <div className="flex justify-between items-center text-amber-400 font-bold">
                  <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 fill-current" /> Early Submit Bonus:</span>
                  <span>+{earlyBonusAwarded}</span>
                </div>
              )}
              {negativePenalty > 0 && (
                <div className="flex justify-between items-center text-rose-400 font-bold">
                  <span>Wrong Penalty:</span>
                  <span>-{negativePenalty}</span>
                </div>
              )}
              {isFastest && (
                <div className="mt-2 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-extrabold text-center py-1.5 rounded-lg flex items-center justify-center gap-1.5 uppercase text-[10px] tracking-wider animate-bounce">
                  <Zap className="w-3.5 h-3.5 fill-current" /> ⚡ Fastest Correct Answer!
                </div>
              )}
            </div>
          </div>

          {/* Total & Rank Grid */}
          <div className="grid grid-cols-2 gap-4 w-full border-t border-slate-850 pt-5 mt-1">
            <div className="space-y-0.5 text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Score</span>
              <span className="text-xl font-black text-slate-200">{newTotalScore}</span>
            </div>
            <div className="space-y-0.5 text-center border-l border-slate-850">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Current Rank</span>
              <span className="text-xl font-black text-indigo-400 flex items-center justify-center gap-1">
                <Award className="w-4 h-4" /> #{newRank} <span className="text-xs text-slate-500 font-semibold">of {totalParticipants}</span>
              </span>
            </div>
          </div>

          {/* Question context preview */}
          <div className="w-full text-left bg-slate-900/40 p-4 rounded-xl text-xs space-y-2 border border-slate-900">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Correct Answer</span>
              <p className="font-bold text-emerald-400 leading-tight">{correctOptText}</p>
            </div>
            {selectedOptionId && !isCorrect && (
              <div className="pt-2 border-t border-slate-900">
                <span className="text-[10px] text-slate-500 font-bold uppercase block mb-0.5">Your Choice</span>
                <p className="font-bold text-rose-400 leading-tight">{selectedOptText}</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Progress Countdown Bar */}
      <footer className="w-full max-w-4xl mx-auto mt-6">
        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-850">
          <div
            className={`h-full bg-indigo-500 transition-all duration-100 ease-linear`}
            style={{ width: `${timerPercentage}%` }}
          ></div>
        </div>
      </footer>
    </div>
  );
}
