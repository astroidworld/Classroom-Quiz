import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuizStore } from '../store/quizStore.js';
import QuestionForm from '../components/QuestionForm.js';
import BulkPasteModal from '../components/BulkPasteModal.js';
import CSVImportModal from '../components/CSVImportModal.js';
import { 
  ArrowLeft, Save, Settings, Layers, Trash2, Edit, 
  ArrowUp, ArrowDown, GripVertical, FileSpreadsheet, 
  ClipboardPaste, Plus, AlertCircle, RefreshCw, CheckCircle2 
} from 'lucide-react';
import { QuestionDto } from '@classroom-quiz/shared';

export default function QuizEditor() {
  const { quizId } = useParams<{ quizId: string }>();
  const navigate = useNavigate();
  
  const { 
    activeQuiz, isLoading, error, fetchQuiz, 
    updateQuiz, deleteQuestion, reorderQuestions, addQuestion, updateQuestion 
  } = useQuizStore();

  // Settings states
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timePerQuestion, setTimePerQuestion] = useState(30);
  const [pointsMode, setPointsMode] = useState<'STANDARD' | 'DOUBLE' | 'NONE'>('STANDARD');
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const [allowLateJoin, setAllowLateJoin] = useState(true);

  // Layout states
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  
  const [editingQuestion, setEditingQuestion] = useState<QuestionDto | null>(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);

  const [showPasteModal, setShowPasteModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);

  // Drag and drop local state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (quizId) {
      fetchQuiz(quizId);
    }
  }, [quizId, fetchQuiz]);

  // Sync state values when activeQuiz loads
  useEffect(() => {
    if (activeQuiz) {
      setTitle(activeQuiz.title);
      setDescription(activeQuiz.description || '');
      setTimePerQuestion(activeQuiz.settings.timePerQuestion);
      setPointsMode(activeQuiz.settings.pointsMode);
      setShuffleQuestions(activeQuiz.settings.shuffleQuestions);
      setShuffleOptions(activeQuiz.settings.shuffleOptions);
      setShowLeaderboard(activeQuiz.settings.showLeaderboardBetweenQuestions);
      setAllowLateJoin(activeQuiz.settings.allowLateJoin);
      setSettingsError(null);
    }
  }, [activeQuiz]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizId) return;

    setIsSavingSettings(true);
    setSettingsError(null);
    setSettingsSuccess(false);

    try {
      await updateQuiz(quizId, {
        title,
        description: description || null,
        settings: {
          timePerQuestion: Number(timePerQuestion),
          pointsMode,
          shuffleQuestions,
          shuffleOptions,
          showLeaderboardBetweenQuestions: showLeaderboard,
          allowLateJoin,
        }
      } as any);
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      setSettingsError(err.message || 'Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (!quizId) return;
    if (confirm('Are you sure you want to delete this question?')) {
      try {
        await deleteQuestion(quizId, qId);
      } catch (err: any) {
        alert(err.message || 'Failed to delete question.');
      }
    }
  };

  const handleSaveQuestionForm = async (qData: any) => {
    if (!quizId) return;

    try {
      if (editingQuestion && editingQuestion.id) {
        await updateQuestion(quizId, editingQuestion.id, qData);
      } else {
        await addQuestion(quizId, qData);
      }
      setIsAddingQuestion(false);
      setEditingQuestion(null);
    } catch (err: any) {
      throw err;
    }
  };

  // HTML5 Drag and Drop for reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    // Make transparent drag preview
    const dragImg = new Image();
    dragImg.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(dragImg, 0, 0);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !activeQuiz?.questions) return;

    const list = [...activeQuiz.questions];
    // Reorder local state array
    const draggedItem = list[draggedIndex];
    list.splice(draggedIndex, 1);
    list.splice(index, 0, draggedItem);

    setDraggedIndex(index);
    // Update local state without API call until DragEnd
    useQuizStore.setState({
      activeQuiz: {
        ...activeQuiz,
        questions: list,
      },
    });
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    if (!quizId || !activeQuiz?.questions) return;

    // Build the payload mapping IDs to order index values
    const orders = activeQuiz.questions.map((q, idx) => ({
      id: q.id as string,
      order: idx + 1,
    }));

    try {
      await reorderQuestions(quizId, orders);
    } catch (err: any) {
      alert(err.message || 'Failed to save question orders.');
      // Refetch on error to revert
      fetchQuiz(quizId);
    }
  };

  if (isLoading && !activeQuiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin" />
          <p className="text-slate-400 font-semibold">Loading quiz editor...</p>
        </div>
      </div>
    );
  }

  if (error || !activeQuiz) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-card max-w-md p-8 rounded-2xl text-center shadow-glow">
          <AlertCircle className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display mb-2">Quiz load failed</h2>
          <p className="text-slate-400 text-sm mb-6 font-medium">{error || 'Quiz not found or unauthorized.'}</p>
          <Link 
            to="/host/dashboard" 
            className="inline-block bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white pb-16">
      {/* Back Header */}
      <header className="glass-panel sticky top-0 z-40 px-6 py-4 mb-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/host/dashboard"
              className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-900 border border-slate-800 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Editor Mode</span>
              <h1 className="text-xl font-bold font-display tracking-tight mt-0.5 text-glow">{activeQuiz.title}</h1>
            </div>
          </div>
          
          <button
            onClick={() => navigate(`/host/play/${activeQuiz.id}`)}
            className="bg-indigo-500 hover:bg-indigo-650 text-white text-sm font-bold py-2 px-4 rounded-xl shadow-md transition-all transform hover:-translate-y-0.5"
          >
            Host Quiz Room
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Quiz Configurations */}
        <div className="lg:col-span-1 space-y-6">
          <div className="glass-card rounded-2xl p-6 border-slate-700/60 shadow-md">
            <h2 className="text-lg font-bold font-display tracking-tight flex items-center gap-2 text-indigo-400 border-b border-slate-800 pb-4 mb-6">
              <Settings className="w-5 h-5" /> Quiz Configurations
            </h2>

            {settingsError && (
              <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span className="text-sm font-medium">{settingsError}</span>
              </div>
            )}

            {settingsSuccess && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 p-4 rounded-xl mb-4 flex items-center gap-3 animate-fade-in">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
                <span className="text-sm font-semibold">Settings saved successfully!</span>
              </div>
            )}

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Quiz Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-650 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-650 text-sm resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Default Timer (seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={timePerQuestion}
                  onChange={(e) => setTimePerQuestion(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Scoring Mode
                </label>
                <select
                  value={pointsMode}
                  onChange={(e) => setPointsMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
                >
                  <option value="STANDARD">Standard (Speed Bonus)</option>
                  <option value="DOUBLE">Double Points (2x)</option>
                  <option value="NONE">No Points</option>
                </select>
              </div>

              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={shuffleQuestions}
                    onChange={(e) => setShuffleQuestions(e.target.checked)}
                    className="w-4 h-4 bg-slate-900 border border-slate-850 rounded text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-white transition-colors">Shuffle Questions Order</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={shuffleOptions}
                    onChange={(e) => setShuffleOptions(e.target.checked)}
                    className="w-4 h-4 bg-slate-900 border border-slate-850 rounded text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-white transition-colors">Shuffle Option Choices</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={showLeaderboard}
                    onChange={(e) => setShowLeaderboard(e.target.checked)}
                    className="w-4 h-4 bg-slate-900 border border-slate-850 rounded text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-white transition-colors">Show Leaderboard in-between</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group text-sm font-semibold select-none">
                  <input
                    type="checkbox"
                    checked={allowLateJoin}
                    onChange={(e) => setAllowLateJoin(e.target.checked)}
                    className="w-4 h-4 bg-slate-900 border border-slate-850 rounded text-indigo-600 focus:ring-indigo-500 transition-all cursor-pointer"
                  />
                  <span className="text-slate-300 group-hover:text-white transition-colors">Allow Late Participant Joins</span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full bg-slate-900 hover:bg-indigo-600 border border-slate-800 hover:border-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-4"
              >
                {isSavingSettings ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="w-4.5 h-4.5 text-slate-400 group-hover:text-white" />
                    Save Configurations
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: Questions List & Forms */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Editor panel triggers */}
          {isAddingQuestion || editingQuestion ? (
            <QuestionForm
              question={editingQuestion}
              onSave={handleSaveQuestionForm}
              onCancel={() => {
                setIsAddingQuestion(false);
                setEditingQuestion(null);
              }}
            />
          ) : (
            <div className="glass-card rounded-2xl p-6 border-slate-700/60 shadow-md space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <h2 className="text-lg font-bold font-display tracking-tight flex items-center gap-2 text-indigo-400">
                  <Layers className="w-5 h-5" /> Question Items ({activeQuiz.questions?.length ?? 0})
                </h2>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setShowPasteModal(true)}
                    className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <ClipboardPaste className="w-4 h-4 text-slate-400" /> Paste
                  </button>
                  <button
                    onClick={() => setShowCSVModal(true)}
                    className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-300 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-slate-400" /> CSV
                  </button>
                  <button
                    onClick={() => setIsAddingQuestion(true)}
                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all transform hover:-translate-y-0.5"
                  >
                    <Plus className="w-4 h-4" /> Add Question
                  </button>
                </div>
              </div>

              {/* Questions List */}
              {!activeQuiz.questions || activeQuiz.questions.length === 0 ? (
                <div className="text-center py-16 text-slate-500 border border-dashed border-slate-850 rounded-xl bg-slate-950/20">
                  <p className="font-medium text-sm">No questions in this quiz yet.</p>
                  <p className="text-xs text-slate-650 mt-1">Add items manually or use bulk importers to populate them.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeQuiz.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={(e) => handleDragOver(e, idx)}
                      onDragEnd={handleDragEnd}
                      className={`glass-panel p-5 rounded-2xl border border-slate-850/60 hover:border-indigo-500/20 flex gap-4 transition-all group ${
                        draggedIndex === idx ? 'opacity-35 scale-[0.98] border-indigo-500 bg-indigo-500/5' : ''
                      }`}
                    >
                      {/* Drag handle */}
                      <div className="flex items-center text-slate-600 hover:text-slate-400 cursor-grab shrink-0">
                        <GripVertical className="w-5 h-5" />
                      </div>

                      {/* Question Index Badge */}
                      <div className="flex flex-col items-center justify-start shrink-0">
                        <div className="w-8 h-8 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-xs font-black text-indigo-400">
                          {idx + 1}
                        </div>
                      </div>

                      {/* Question Content */}
                      <div className="flex-1 space-y-3.5">
                        <div className="flex justify-between items-start gap-4">
                          <p className="font-bold text-white text-sm leading-relaxed">{q.text}</p>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setEditingQuestion(q)}
                              className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-850 transition-all"
                              title="Edit Question"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => q.id && handleDeleteQuestion(q.id)}
                              className="text-slate-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-850 transition-all"
                              title="Delete Question"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Options badge list */}
                        <div className="flex flex-wrap gap-2 pt-1.5">
                          {q.options.map((opt) => (
                            <span
                              key={opt.id}
                              className={`px-3 py-1 rounded-lg border text-[11px] font-bold ${
                                opt.isCorrect
                                  ? 'bg-emerald-500/10 border-emerald-500/35 text-emerald-400'
                                  : 'bg-slate-900 border-slate-850 text-slate-500'
                              }`}
                            >
                              {opt.text}
                            </span>
                          ))}
                        </div>

                        {/* Metadata Row */}
                        <div className="flex items-center gap-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          <span>{q.type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{q.timeLimitSec || activeQuiz.settings.timePerQuestion}s Timer</span>
                          <span>•</span>
                          <span>{q.points} Points</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Importer Modals */}
      {showPasteModal && (
        <BulkPasteModal
          quizId={activeQuiz.id}
          onClose={() => setShowPasteModal(false)}
          onSuccess={() => fetchQuiz(activeQuiz.id)}
        />
      )}

      {showCSVModal && (
        <CSVImportModal
          quizId={activeQuiz.id}
          onClose={() => setShowCSVModal(false)}
          onSuccess={() => fetchQuiz(activeQuiz.id)}
        />
      )}
    </div>
  );
}
