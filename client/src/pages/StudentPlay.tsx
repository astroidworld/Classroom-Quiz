import React from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { Volume2, VolumeX, HelpCircle } from 'lucide-react';
import CodeBlock from '../components/CodeBlock.js';

// Accessibility Shape SVGs
const TriangleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-white shrink-0">
    <polygon points="12,3 2,21 22,21" />
  </svg>
);

const DiamondIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-white shrink-0">
    <polygon points="12,2 2,12 12,22 22,12" />
  </svg>
);

const CircleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-white shrink-0">
    <circle cx="12" cy="12" r="10" />
  </svg>
);

const SquareIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current text-white shrink-0">
    <rect x="3" y="3" width="18" height="18" rx="2" />
  </svg>
);

const optionStyles = [
  { bg: 'bg-red-500 hover:bg-red-650', border: 'border-red-600', icon: <TriangleIcon /> },
  { bg: 'bg-blue-500 hover:bg-blue-650', border: 'border-blue-600', icon: <DiamondIcon /> },
  { bg: 'bg-yellow-500 hover:bg-yellow-600 text-slate-950', border: 'border-yellow-600', icon: <CircleIcon /> },
  { bg: 'bg-green-500 hover:bg-green-650', border: 'border-green-600', icon: <SquareIcon /> },
];

export default function StudentPlay() {
  const { 
    activeQuestion, questionIndex, totalQuestions, secondsRemaining, 
    timeLimitSec, submitAnswer, selectAnswer, isAnswerLocked, selectedOptionId, 
    isMuted, setMute, submissionMode 
  } = useSocketStore();

  if (!activeQuestion) return null;

  // Calculate timer width percentage
  const timerPercentage = (secondsRemaining / timeLimitSec) * 100;
  
  // Timer color states
  const timerColor = secondsRemaining <= 5 
    ? 'bg-red-500' 
    : secondsRemaining <= 10 
    ? 'bg-yellow-500' 
    : 'bg-indigo-500';

  const handleOptionClick = (optionId: string) => {
    if (isAnswerLocked) return;
    if (submissionMode === 'auto') {
      submitAnswer(optionId);
    } else {
      selectAnswer(optionId);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between text-white p-4">
      {/* Top Header */}
      <header className="glass-panel rounded-xl px-5 py-3 flex justify-between items-center w-full mb-4">
        <div className="flex items-center gap-3">
          <span className="bg-indigo-500/20 text-indigo-400 text-xs px-2.5 py-1 rounded-lg font-black uppercase tracking-wider">
            Q {questionIndex} / {totalQuestions}
          </span>
          <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider">
            Mode: {submissionMode === 'auto' ? 'Tap to Lock' : 'Select & Submit'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setMute(!isMuted)}
            className="p-2 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-lg transition-all text-slate-400 hover:text-white"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Timer Bar */}
      <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden mb-6 border border-slate-850">
        <div 
          className={`h-full ${timerColor} transition-all duration-300`} 
          style={{ width: `${timerPercentage}%` }}
        ></div>
      </div>

      {/* Main Board */}
      <main className="flex-1 flex flex-col justify-center items-center max-w-4xl mx-auto w-full mb-6">
        <div className="glass-card rounded-2xl p-8 w-full border-slate-700/50 flex flex-col items-center gap-6 relative shadow-glow text-center">
          {/* Question Text */}
          <h2 className="text-2xl sm:text-3xl font-extrabold font-display leading-tight text-white select-none">
            {activeQuestion.text}
          </h2>

          {/* Question Image (Optional) */}
          {activeQuestion.imageUrl && (
            <div className="w-full max-w-md h-48 sm:h-64 rounded-xl overflow-hidden border border-slate-800/80 bg-slate-950/20 flex items-center justify-center">
              <img 
                src={activeQuestion.imageUrl} 
                alt="Question diagram" 
                className="w-full h-full object-contain"
              />
            </div>
          )}

          {/* Question Code Snippet (Optional) */}
          {activeQuestion.codeSnippet && (
            <div className="w-full max-w-3xl mt-2">
              <CodeBlock 
                code={activeQuestion.codeSnippet} 
                language={activeQuestion.codeLanguage || 'text'} 
              />
            </div>
          )}
        </div>
      </main>

      {/* Bottom Option Grid & Control Panel */}
      <div className="w-full max-w-4xl mx-auto relative min-h-36">
        {/* Option Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeQuestion.options.map((opt, idx) => {
            const style = optionStyles[idx] || optionStyles[0];
            const isSelected = selectedOptionId === opt.id;
            
            // Visual highlight classes based on state
            let highlightClass = '';
            if (isAnswerLocked) {
              highlightClass = isSelected 
                ? 'ring-4 ring-white border-white scale-[1.01] shadow-glow-indigo' 
                : 'opacity-30 filter grayscale pointer-events-none';
            } else if (isSelected) {
              highlightClass = 'ring-4 ring-indigo-400 border-indigo-400 scale-[1.01]';
            } else if (selectedOptionId !== null) {
              highlightClass = 'opacity-60';
            }

            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick(opt.id)}
                disabled={isAnswerLocked}
                aria-label={`Option ${idx + 1}: ${opt.text}`}
                className={`w-full rounded-2xl border-b-4 ${style.bg} ${style.border} px-6 py-5 flex items-center gap-4 text-left transition-all active:scale-[0.98] select-none ${highlightClass}`}
              >
                {style.icon}
                <span className="font-display font-black text-xl tracking-tight leading-none">
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* Manual Submit Button */}
        {submissionMode === 'manual' && selectedOptionId && !isAnswerLocked && (
          <button
            onClick={() => submitAnswer(null)}
            className="w-full mt-5 py-4 rounded-2xl bg-indigo-500 hover:bg-indigo-600 border-b-4 border-indigo-700 text-white font-black uppercase tracking-wider shadow-lg active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            Submit Answer
          </button>
        )}

        {/* Locked Pending Status Banner */}
        {isAnswerLocked && (
          <div className="w-full mt-5 py-4 px-6 glass-panel border-indigo-550/20 bg-indigo-950/25 rounded-2xl flex items-center justify-center gap-3 animate-pulse">
            <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-indigo-400 font-extrabold text-sm uppercase tracking-wider text-center">
              Submitted ✓ Answer Locked In — Waiting for host to reveal...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
