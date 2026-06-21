import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  HelpCircle, ChevronLeft, ChevronRight, CheckCircle2, 
  ArrowLeft, Info, AlertCircle 
} from 'lucide-react';
import CodeBlock from '../components/CodeBlock.js';

interface ReviewOption {
  id: string;
  text: string;
  isCorrect: boolean;
}

interface ReviewQuestion {
  id: string;
  order: number;
  text: string;
  imageUrl: string | null;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  explanation: string | null;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  options: ReviewOption[];
}

export default function StudentReview() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [quizTitle, setQuizTitle] = useState('');
  const [questions, setQuestions] = useState<ReviewQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchReviewData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/sessions/${sessionId}/review`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load review data');

        setQuizTitle(json.data.quizTitle);
        setQuestions(json.data.questions);
      } catch (err: any) {
        setError(err.message || 'Could not load practice review details.');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchReviewData();
    }
  }, [sessionId]);

  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-semibold">Loading practice review...</p>
        </div>
      </div>
    );
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-card max-w-md p-8 rounded-2xl text-center shadow-glow border-red-500/20">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display mb-2">Review Unavailable</h2>
          <p className="text-slate-400 text-sm mb-6 font-medium">{error || 'No questions found for review.'}</p>
          <button 
            onClick={() => navigate('/')} 
            className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm shadow-md"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentIndex];
  const optionColors = [
    'bg-quizRed/10 border-red-500/30 text-white',
    'bg-quizBlue/10 border-blue-500/30 text-white',
    'bg-quizYellow/10 border-yellow-500/30 text-white',
    'bg-quizGreen/10 border-green-500/30 text-white',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      {/* Header */}
      <header className="glass-panel sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-850 transition-all"
            title="Exit Review"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block">Practice Review Mode</span>
            <span className="text-sm font-extrabold text-white truncate max-w-[200px] block">{quizTitle}</span>
          </div>
        </div>

        <span className="bg-slate-900 border border-slate-850 text-slate-400 text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
          Question {currentIndex + 1} of {questions.length}
        </span>
      </header>

      {/* Main Review Board */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col justify-center space-y-6">
        
        {/* Progress Dots */}
        <div className="flex justify-center gap-1.5 select-none overflow-x-auto py-1 scrollbar-none">
          {questions.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all shrink-0 ${
                idx === currentIndex 
                  ? 'bg-indigo-500 w-6' 
                  : 'bg-slate-800 hover:bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Question Text */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold font-display tracking-tight leading-snug">
            {currentQuestion.text}
          </h2>
          {currentQuestion.imageUrl && (
            <div className="max-w-sm mx-auto rounded-2xl overflow-hidden border border-slate-850 shadow-md">
              <img src={currentQuestion.imageUrl} alt="Question Graphic" className="w-full h-40 object-cover" />
            </div>
          )}
          {currentQuestion.codeSnippet && (
            <div className="w-full max-w-3xl mx-auto mt-4 text-left">
              <CodeBlock 
                code={currentQuestion.codeSnippet} 
                language={currentQuestion.codeLanguage || 'text'} 
              />
            </div>
          )}
        </div>

        {/* Options Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.options.map((opt, idx) => {
            const isCorrect = opt.isCorrect;
            const borderBg = isCorrect
              ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400'
              : 'bg-slate-950/40 border-slate-850/60 text-slate-400 opacity-60';

            return (
              <div
                key={opt.id}
                className={`p-5 rounded-xl border flex justify-between items-center text-base font-bold select-none ${borderBg}`}
              >
                <span>{opt.text}</span>
                {isCorrect && (
                  <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Correct Choice
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Explanation Card */}
        {currentQuestion.explanation && (
          <div className="bg-slate-900/60 border border-slate-850 p-5 rounded-xl flex gap-3 shadow-inner">
            <Info className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Explanation Details</h4>
              <p className="text-xs text-slate-350 leading-relaxed font-semibold">{currentQuestion.explanation}</p>
            </div>
          </div>
        )}

        {/* Carousel Controls */}
        <div className="flex justify-between items-center pt-4 border-t border-slate-900">
          <button
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          {currentIndex === questions.length - 1 ? (
            <button
              onClick={() => navigate('/')}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-5 rounded-xl transition-all shadow-md text-xs"
            >
              Finish Review
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-450 hover:text-white transition-colors"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-[10px] text-slate-600 font-bold uppercase tracking-widest select-none">
        Self-Paced Practice & Review Mode
      </footer>
    </div>
  );
}
