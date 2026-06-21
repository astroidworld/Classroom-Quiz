import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuizStore } from '../store/quizStore.js';
import { useAuthStore } from '../store/authStore.js';
import { 
  Plus, Trash2, Edit, Play, LogOut, FileText, 
  HelpCircle, Settings, Clock, Layers, AlertCircle, RefreshCw, BarChart3,
  Calendar, Copy, Check
} from 'lucide-react';

export default function QuizList() {
  const { quizzes, isLoading, error, fetchQuizzes, createQuiz, deleteQuiz } = useQuizStore();
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Homework/Assign states
  const [showHomeworkModal, setShowHomeworkModal] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [homeworkStart, setHomeworkStart] = useState('');
  const [homeworkEnd, setHomeworkEnd] = useState('');
  const [createdHomeworkSession, setCreatedHomeworkSession] = useState<{ sessionId: string; joinCode: string } | null>(null);
  const [assigningHomework, setAssigningHomework] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const token = useAuthStore((state) => state.token);

  const openHomeworkModal = (quizId: string) => {
    setSelectedQuizId(quizId);
    setCreatedHomeworkSession(null);
    setAssignError(null);
    const now = new Date();
    const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    
    const formatLocalISO = (date: Date) => {
      const offsetMs = date.getTimezoneOffset() * 60 * 1000;
      const localTime = new Date(date.getTime() - offsetMs);
      return localTime.toISOString().slice(0, 16);
    };
    
    setHomeworkStart(formatLocalISO(now));
    setHomeworkEnd(formatLocalISO(future));
    setShowHomeworkModal(true);
  };

  const handleAssignHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedQuizId) return;

    setAssigningHomework(true);
    setAssignError(null);
    try {
      const res = await fetch(`/api/quizzes/${selectedQuizId}/sessions/homework`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          homeworkStart,
          homeworkEnd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to create homework assignment');

      setCreatedHomeworkSession({
        sessionId: json.data.sessionId,
        joinCode: json.data.joinCode,
      });
    } catch (err: any) {
      setAssignError(err.message || 'Error creating homework session.');
    } finally {
      setAssigningHomework(false);
    }
  };

  const copyHomeworkLink = (code: string) => {
    const link = `${window.location.origin}/?code=${code}`;
    navigator.clipboard.writeText(link);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  useEffect(() => {
    fetchQuizzes();
  }, [fetchQuizzes]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsCreating(true);
    setCreateError(null);
    try {
      const quiz = await createQuiz({
        title: newTitle,
        description: newDescription || null,
      } as any);
      setShowCreateModal(false);
      setNewTitle('');
      setNewDescription('');
      // Navigate directly to editor for the newly created quiz
      navigate(`/host/quizzes/${quiz.id}/edit`);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create quiz');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (confirm(`Are you sure you want to delete the quiz "${title}"? This will delete all its questions and historical sessions.`)) {
      try {
        await deleteQuiz(id);
      } catch (err: any) {
        alert(err.message || 'Failed to delete quiz');
      }
    }
  };

  return (
    <div className="min-h-screen text-white pb-12">
      {/* Navigation Header */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 mb-8">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="font-display text-2xl font-black tracking-tight text-white">
              Classroom <span className="text-indigo-400">Quiz</span>
            </span>
            <span className="bg-indigo-500/15 text-indigo-400 text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
              Host Panel
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold">{user?.name}</p>
              <p className="text-xs text-slate-400">{user?.email}</p>
            </div>
            
            <button 
              onClick={logout}
              className="bg-slate-900/60 hover:bg-red-500/10 border border-slate-800 hover:border-red-500/20 text-slate-300 hover:text-red-400 p-2.5 rounded-xl transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6">
        {/* Dashboard Actions Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display tracking-tight text-white">Your Quizzes</h1>
            <p className="text-slate-400 text-sm mt-1">Manage, import, or host live trivia classrooms</p>
          </div>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-bold py-3 px-5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            Create New Quiz
          </button>
        </div>

        {/* Load / Error States */}
        {isLoading && quizzes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
            <p className="text-slate-400 font-medium">Fetching quizzes...</p>
          </div>
        ) : error ? (
          <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-6 rounded-xl flex items-start gap-4 mb-8">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5 text-red-400" />
            <div>
              <h3 className="font-semibold text-lg">Error loading quizzes</h3>
              <p className="text-sm mt-1 text-slate-400">{error}</p>
              <button 
                onClick={fetchQuizzes}
                className="mt-3 bg-red-500/20 text-red-300 px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-red-500/30 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        ) : quizzes.length === 0 ? (
          <div className="glass-card p-12 text-center rounded-2xl py-16">
            <HelpCircle className="w-16 h-16 mx-auto text-slate-600 mb-4" />
            <h3 className="text-xl font-bold mb-2">No quizzes created yet</h3>
            <p className="text-slate-400 max-w-md mx-auto mb-8 font-medium">
              Create your first classroom quiz manually, paste a text bank, or import from a CSV spreadsheet to start hosting.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-indigo-500 hover:bg-indigo-600 font-bold px-6 py-3 rounded-xl transition-all"
            >
              Get Started
            </button>
          </div>
        ) : (
          /* Quiz Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {quizzes.map((quiz) => (
              <div 
                key={quiz.id} 
                className="glass-card rounded-2xl p-6 flex flex-col justify-between hover:shadow-glow hover:border-slate-600/30 transition-all group"
              >
                <div>
                  <h3 className="text-xl font-bold tracking-tight mb-2 text-white group-hover:text-indigo-400 transition-colors">
                    {quiz.title}
                  </h3>
                  <p className="text-slate-400 text-sm font-medium line-clamp-2 mb-6">
                    {quiz.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4 mb-6 text-slate-400 text-xs font-semibold">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-400" />
                      <span>{((quiz as any)._count?.questions ?? 0)} Questions</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-indigo-400" />
                      <span>{quiz.settings.timePerQuestion}s Timer</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Primary Actions Row */}
                    <div className="flex gap-2.5">
                      <button
                        onClick={() => navigate(`/host/play/${quiz.id}`)}
                        className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-md"
                        title="Launch Live Game Room"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        Host
                      </button>
                      <button
                        onClick={() => openHomeworkModal(quiz.id)}
                        className="flex-1 bg-indigo-650 hover:bg-indigo-750 text-white font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-2 text-sm shadow-sm"
                        title="Assign Homework (Self-Paced)"
                      >
                        <Calendar className="w-4 h-4" />
                        Assign
                      </button>
                    </div>

                    {/* Secondary Actions Row */}
                    <div className="flex items-center justify-between gap-2 border-t border-slate-850 pt-2.5">
                      <button
                        onClick={() => navigate(`/host/quizzes/${quiz.id}/edit`)}
                        className="flex-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-white font-bold py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 text-slate-400" />
                        Edit
                      </button>
                      <button
                        onClick={() => navigate(`/host/quizzes/${quiz.id}/sessions`)}
                        className="bg-slate-900/60 hover:bg-slate-800 border border-slate-850 hover:border-slate-750 text-slate-400 hover:text-white p-2 rounded-lg transition-all flex items-center justify-center gap-1.5 text-xs font-semibold"
                        title="View Quiz Reports & Session History"
                      >
                        <BarChart3 className="w-3.5 h-3.5" />
                        Reports
                      </button>
                      <button
                        onClick={() => handleDelete(quiz.id, quiz.title)}
                        className="bg-slate-905 hover:bg-red-500/10 border border-slate-850 hover:border-red-500/20 text-slate-500 hover:text-red-400 p-2 rounded-lg transition-all"
                        title="Delete Quiz"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Quiz Dialog Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-glow relative animate-scale-in">
            <h2 className="text-2xl font-bold font-display tracking-tight mb-6">Create New Quiz</h2>
            
            {createError && (
              <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span className="text-sm font-medium">{createError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Quiz Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. JavaScript Closures & Scope"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Provide details about the classroom curriculum..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-600 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                >
                  {isCreating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Create Quiz'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Homework Modal */}
      {showHomeworkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-glow relative animate-scale-in">
            <h2 className="text-2xl font-bold font-display tracking-tight mb-6">Assign Homework</h2>
            
            {assignError && (
              <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span className="text-sm font-medium">{assignError}</span>
              </div>
            )}

            {!createdHomeworkSession ? (
              <form onSubmit={handleAssignHomework} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Start Datetime
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={homeworkStart}
                    onChange={(e) => setHomeworkStart(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    End Datetime (Deadline)
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={homeworkEnd}
                    onChange={(e) => setHomeworkEnd(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all font-medium"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHomeworkModal(false)}
                    className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-all text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={assigningHomework}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {assigningHomework ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      'Assign Quiz'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6 text-center">
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl text-emerald-400 text-sm font-semibold">
                  Homework assigned successfully!
                </div>
                
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider block">Student Join Code</span>
                  <div className="bg-slate-900 border border-slate-800 rounded-xl py-4 text-3xl font-black tracking-widest text-white shadow-inner">
                    {createdHomeworkSession.joinCode}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => copyHomeworkLink(createdHomeworkSession.joinCode)}
                    className="flex-1 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-350 font-bold py-3 px-4 rounded-xl transition-all text-sm flex items-center justify-center gap-2"
                  >
                    {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copiedCode ? 'Link Copied!' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => {
                      setShowHomeworkModal(false);
                      navigate(`/host/sessions/${createdHomeworkSession.sessionId}/analytics`);
                    }}
                    className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all text-sm"
                  >
                    View Reports
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
