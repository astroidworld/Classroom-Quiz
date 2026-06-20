import React from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { CheckCircle2, XCircle, Flame, AlertCircle, HelpCircle } from 'lucide-react';

export default function StudentLock() {
  const { scoreResult, activeQuestion, correctOptionId, explanation } = useSocketStore();

  if (!activeQuestion) return null;

  const correctOptionText = activeQuestion.options.find(o => o.id === correctOptionId)?.text || '';
  const isCorrect = scoreResult?.isCorrect ?? false;
  const pointsAwarded = scoreResult?.pointsAwarded ?? 0;
  const streak = scoreResult?.streak ?? 0;

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 text-white relative">
      {/* Decorative ambient color accents */}
      <div className={`absolute inset-0 -z-10 opacity-15 blur-3xl transition-all duration-500 ${
        scoreResult ? (isCorrect ? 'bg-emerald-500' : 'bg-red-500') : 'bg-amber-500'
      }`}></div>

      <div className="glass-card w-full max-w-lg p-8 rounded-2xl shadow-glow text-center space-y-6">
        {/* Results Banner */}
        {!scoreResult ? (
          /* Case: Timed out / No answer submitted */
          <div className="space-y-3">
            <AlertCircle className="w-16 h-16 text-amber-500 mx-auto animate-pulse" />
            <h2 className="text-3xl font-black font-display tracking-tight text-amber-400">
              Time's Up!
            </h2>
            <p className="text-slate-400 text-sm font-semibold">You didn't submit an answer in time.</p>
          </div>
        ) : isCorrect ? (
          /* Case: Correct Answer */
          <div className="space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-400 mx-auto" />
            <h2 className="text-3xl font-black font-display tracking-tight text-emerald-400">
              Correct!
            </h2>
            <p className="text-slate-400 text-sm font-semibold">You locked in the right answer.</p>
          </div>
        ) : (
          /* Case: Incorrect Answer */
          <div className="space-y-3">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-3xl font-black font-display tracking-tight text-red-400">
              Incorrect
            </h2>
            <p className="text-slate-400 text-sm font-semibold">Better luck on the next question!</p>
          </div>
        )}

        {/* Score & Streak Grid */}
        <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-800/80 py-6 my-2">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">
              Points Earned
            </span>
            <span className={`text-2xl font-black ${isCorrect ? 'text-emerald-400' : 'text-slate-500'}`}>
              +{pointsAwarded}
            </span>
          </div>

          <div className="space-y-1 border-l border-slate-850">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block">
              Current Streak
            </span>
            <div className="flex items-center justify-center gap-1.5">
              {streak > 0 && <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" />}
              <span className={`text-2xl font-black ${streak > 0 ? 'text-orange-500' : 'text-slate-500'}`}>
                {streak}
              </span>
            </div>
          </div>
        </div>

        {/* Question Details / Explanation */}
        <div className="text-left space-y-4 bg-slate-950/20 border border-slate-850 p-5 rounded-xl text-sm">
          <div>
            <span className="text-[10px] text-slate-555 font-bold uppercase tracking-wider block mb-1">
              Correct Answer
            </span>
            <p className="font-extrabold text-emerald-400">{correctOptionText}</p>
          </div>
          
          {explanation && (
            <div className="pt-3 border-t border-slate-850">
              <span className="text-[10px] text-slate-555 font-bold uppercase tracking-wider block mb-1">
                Explanation
              </span>
              <p className="text-slate-450 leading-relaxed text-xs font-semibold">{explanation}</p>
            </div>
          )}
        </div>

        {/* Waiting prompt */}
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2">
          Waiting for host to load next question...
        </p>
      </div>
    </div>
  );
}
