import React from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { HelpCircle, Clock, Lock } from 'lucide-react';

export default function StudentLock() {
  const { activeQuestion, selectedOptionId, isAnswerRevealed } = useSocketStore();

  if (!activeQuestion) return null;

  const selectedOptionText = activeQuestion.options.find(o => o.id === selectedOptionId)?.text || '';

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 text-white relative">
      {/* Ambient background accent */}
      <div className={`absolute inset-0 -z-10 opacity-15 blur-3xl transition-all duration-500 bg-indigo-500`}></div>

      <div className="glass-card w-full max-w-lg p-8 rounded-2xl shadow-glow text-center space-y-6">
        {!isAnswerRevealed ? (
          /* Case A: Pending reveal (Locked In) */
          <div className="space-y-6">
            <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
              <Lock className="w-8 h-8 text-indigo-400 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black font-display tracking-tight text-indigo-300 animate-pulse">
                Answer Locked In!
              </h2>
              <p className="text-slate-400 text-sm font-semibold">
                Waiting for the host to reveal the results...
              </p>
            </div>

            {selectedOptionId ? (
              <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-xl text-left">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1.5">
                  Your Selection
                </span>
                <p className="font-extrabold text-slate-200 text-lg leading-tight">
                  {selectedOptionText}
                </p>
              </div>
            ) : (
              <div className="bg-amber-950/20 border border-amber-900/20 p-5 rounded-xl text-left flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider block">
                    Unanswered
                  </span>
                  <p className="font-bold text-slate-400 text-sm">
                    No answer selected. Waiting for reveal...
                  </p>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Case B: Answer revealed, waiting for next question */
          <div className="space-y-6">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-3 border-indigo-500/30 border-t-indigo-400 animate-spin"></div>
              <HelpCircle className="w-6 h-6 text-indigo-450" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black font-display tracking-tight text-slate-200">
                Ready for Next Question
              </h2>
              <p className="text-slate-450 text-xs font-bold uppercase tracking-widest animate-pulse">
                Waiting for host to advance...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
