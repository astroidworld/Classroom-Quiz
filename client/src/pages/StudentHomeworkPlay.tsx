import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Trophy, CheckCircle2, XCircle, AlertCircle, Clock, 
  HelpCircle, ChevronRight, Volume2, VolumeX, ArrowLeft 
} from 'lucide-react';
import { playCorrectSound, playIncorrectSound, getMuteState, toggleMute } from '../utils/audio.js';
import CodeBlock from '../components/CodeBlock.js';

interface HomeworkQuestion {
  id: string;
  order: number;
  text: string;
  imageUrl: string | null;
  type: 'MCQ_SINGLE' | 'TRUE_FALSE';
  timeLimitSec: number;
  codeSnippet?: string | null;
  codeLanguage?: string | null;
  options: { id: string; text: string }[];
}

export default function StudentHomeworkPlay() {
  const { participantId } = useParams<{ participantId: string }>();
  const navigate = useNavigate();

  // Play States
  const [quizTitle, setQuizTitle] = useState('');
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<HomeworkQuestion | null>(null);
  const [questionIndex, setQuestionIndex] = useState(1);
  const [completed, setCompleted] = useState(false);
  const [scoreSummary, setScoreSummary] = useState<{ finalScore: number; accuracy: number; totalAnswered: number } | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [isAnswered, setIsAnswered] = useState(false);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [correctOptionId, setCorrectOptionId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [pointsEarned, setPointsEarned] = useState(0);
  const [isMuted, setIsMuted] = useState(getMuteState());

  // Countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const timerInterval = useRef<any>(null);

  // Fetch question details on mount / transition
  const fetchQuestion = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/homework/${participantId}/question`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to fetch homework question');

      const data = json.data;
      if (data.completed) {
        setCompleted(true);
        setScoreSummary(data.scoreSummary);
      } else {
        setQuizTitle(data.quizTitle || 'Homework Quiz');
        setTotalQuestions(data.totalQuestions || 0);
        setCurrentQuestion(data.question);
        setQuestionIndex(data.questionIndex || 1);
        setIsAnswered(false);
        setSelectedOptionId(null);
        setCorrectOptionId(null);
        setExplanation(null);
        setPointsEarned(0);
        
        // Start local countdown
        const limit = data.question.timeLimitSec || 30;
        setSecondsRemaining(limit);
        startCountdown(limit);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading homework question.');
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = (limitSec: number) => {
    if (timerInterval.current) clearInterval(timerInterval.current);
    
    let currentVal = limitSec;
    timerInterval.current = setInterval(() => {
      currentVal -= 1;
      setSecondsRemaining(currentVal);

      if (currentVal <= 0) {
        clearInterval(timerInterval.current);
        // Time expired, auto-submit empty or handle lock
        handleTimeOut();
      }
    }, 1000);
  };

  const handleTimeOut = () => {
    // If they haven't answered, lock them out with incorrect state
    if (!isAnswered) {
      submitAnswer('');
    }
  };

  useEffect(() => {
    if (participantId) {
      fetchQuestion();
    }
    return () => {
      if (timerInterval.current) clearInterval(timerInterval.current);
    };
  }, [participantId]);

  const submitAnswer = async (optionId: string) => {
    if (isAnswered || submitting || !currentQuestion) return;
    
    if (timerInterval.current) clearInterval(timerInterval.current);
    setSubmitting(true);
    setSelectedOptionId(optionId);
    
    try {
      const res = await fetch(`/api/sessions/homework/${participantId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: currentQuestion.id,
          optionId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to submit answer');

      const data = json.data;
      setCorrectOptionId(data.correctOptionId);
      setExplanation(data.explanation);
      setPointsEarned(data.pointsAwarded);
      setIsAnswered(true);

      // Play audio feedback
      if (!isMuted) {
        if (data.isCorrect) {
          playCorrectSound();
        } else {
          playIncorrectSound();
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit answer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/homework/${participantId}/next-question`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to advance to next question');

      const data = json.data;
      if (data.completed) {
        setCompleted(true);
        setScoreSummary(data.scoreSummary);
      } else {
        fetchQuestion(); // Load the advanced question details
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load next question.');
      setLoading(false);
    }
  };

  const handleMuteToggle = () => {
    const nextMute = toggleMute();
    setIsMuted(nextMute);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-semibold">Loading homework quiz...</p>
        </div>
      </div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-card max-w-md p-8 rounded-2xl text-center shadow-glow border-red-500/20">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display mb-2">Quiz Load Error</h2>
          <p className="text-slate-400 text-sm mb-6 font-medium">{error}</p>
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

  // ==========================================
  // COMPLETED SCORECARD SCREEN
  // ==========================================
  if (completed && scoreSummary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-card max-w-lg w-full p-8 rounded-3xl text-center shadow-glow border-indigo-500/10 space-y-8 animate-scale-in">
          <div>
            <span className="bg-indigo-500/15 text-indigo-400 text-[10px] px-3.5 py-1.5 rounded-full font-black uppercase tracking-widest">
              Homework Complete
            </span>
            <h1 className="font-display text-3xl font-black mt-4 text-glow">{quizTitle || 'Quiz Complete!'}</h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">Your final scorecard results are listed below</p>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Final Score</span>
              <span className="text-3xl font-black text-indigo-400 block mt-1">{scoreSummary.finalScore} pts</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl text-center">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Accuracy</span>
              <span className="text-3xl font-black text-emerald-400 block mt-1">{scoreSummary.accuracy}%</span>
            </div>
          </div>

          <div className="text-slate-400 text-xs font-semibold leading-relaxed max-w-sm mx-auto">
            Great job completing this practice assignment! Your host will review your results in the dashboard.
          </div>

          <div className="pt-4 border-t border-slate-850">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md text-sm"
            >
              Exit to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  // Option colors mapping
  const optionColors = [
    'bg-quizRed border-red-650 hover:bg-quizRed/85 text-white',
    'bg-quizBlue border-blue-650 hover:bg-quizBlue/85 text-white',
    'bg-quizYellow border-yellow-650 hover:bg-quizYellow/85 text-slate-950',
    'bg-quizGreen border-green-650 hover:bg-quizGreen/85 text-white',
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between">
      {/* Header bar */}
      <header className="glass-panel sticky top-0 z-30 px-6 py-4 flex items-center justify-between border-b border-slate-900">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => { if(confirm('Exit homework session? Your progress is saved.')) navigate('/'); }}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-850 transition-all"
            title="Exit Session"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest block">Homework Practice</span>
            <span className="text-sm font-extrabold text-white truncate max-w-[200px] block">{quizTitle}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMuteToggle}
            className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-850 transition-all"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
          </button>

          <span className="bg-slate-900 border border-slate-850 text-slate-400 text-xs px-3 py-1.5 rounded-xl font-bold uppercase tracking-wider">
            Q{questionIndex} / {totalQuestions}
          </span>
        </div>
      </header>

      {/* Main Game Screen */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-8 flex flex-col justify-center space-y-8">
        
        {/* Countdown Timer bar */}
        {!isAnswered && (
          <div className="space-y-1.5 w-full">
            <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-widest">
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Time Remaining</span>
              <span>{secondsRemaining}s</span>
            </div>
            <div className="w-full bg-slate-900 h-2.5 rounded-full overflow-hidden border border-slate-850">
              <div 
                className="bg-indigo-500 h-full transition-all duration-1000" 
                style={{ width: `${(secondsRemaining / currentQuestion.timeLimitSec) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Question Text */}
        <div className="text-center space-y-4">
          <h2 className="text-2xl md:text-3xl font-bold font-display tracking-tight leading-snug">
            {currentQuestion.text}
          </h2>
          {currentQuestion.imageUrl && (
            <div className="max-w-md mx-auto rounded-2xl overflow-hidden border border-slate-800 shadow-glow">
              <img src={currentQuestion.imageUrl} alt="Question graphic" className="w-full h-48 object-cover" />
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

        {/* Option Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {currentQuestion.options.map((opt, idx) => {
            const isSelected = opt.id === selectedOptionId;
            const isCorrectAnswer = opt.id === correctOptionId;
            
            let btnClass = optionColors[idx % optionColors.length];
            let cellIcon = null;

            if (isAnswered) {
              if (isCorrectAnswer) {
                btnClass = 'bg-emerald-500 border-emerald-650 text-white shadow-emerald-500/20';
                cellIcon = <CheckCircle2 className="w-5 h-5 shrink-0" />;
              } else if (isSelected) {
                btnClass = 'bg-red-500 border-red-650 text-white shadow-red-500/20';
                cellIcon = <XCircle className="w-5 h-5 shrink-0" />;
              } else {
                btnClass = 'bg-slate-900 border-slate-850 text-slate-500 opacity-30 cursor-not-allowed';
              }
            } else {
              btnClass += ' transform active:scale-[0.98] transition-all hover:scale-[1.01]';
            }

            return (
              <button
                key={opt.id}
                onClick={() => submitAnswer(opt.id)}
                disabled={isAnswered || submitting}
                className={`p-6 rounded-2xl border-b-4 flex justify-between items-center text-lg font-black text-left shadow-sm min-h-20 ${btnClass}`}
              >
                <span>{opt.text}</span>
                {cellIcon}
              </button>
            );
          })}
        </div>

        {/* Post-Answer Feedback Block (Explanations & Ranks) */}
        {isAnswered && (
          <div className="glass-card p-6 rounded-2xl border-slate-800/80 animate-fade-in flex flex-col md:flex-row items-center justify-between gap-6 shadow-md">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                {selectedOptionId === correctOptionId ? (
                  <span className="text-emerald-400 font-extrabold text-sm flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" /> Correct (+{pointsEarned} pts)
                  </span>
                ) : (
                  <span className="text-red-400 font-extrabold text-sm flex items-center gap-1 bg-red-500/10 border border-red-500/20 px-2.5 py-0.5 rounded-lg">
                    <XCircle className="w-4 h-4" /> Incorrect (+0 pts)
                  </span>
                )}
              </div>
              
              {explanation ? (
                <div className="space-y-1 pt-1">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Explanation</h4>
                  <p className="text-xs text-slate-300 leading-relaxed font-semibold">{explanation}</p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Reviewing complete. Advance when ready.</p>
              )}
            </div>

            <button
              onClick={handleNext}
              disabled={submitting}
              className="bg-indigo-500 hover:bg-indigo-600 font-bold py-3.5 px-6 rounded-xl transition-all shadow-md text-sm shrink-0 flex items-center gap-2"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>

      {/* Footer bar */}
      <footer className="py-4 text-center text-xs text-slate-650 font-bold tracking-wider select-none">
        Self-Paced Homework Session
      </footer>
    </div>
  );
}
