import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { 
  ArrowLeft, Users, Percent, Trophy, Clock, ChevronRight, 
  TrendingUp, Grid, FileText, BarChart3, HelpCircle, 
  RefreshCw, AlertCircle, Calendar, User, Check, X, ShieldAlert, Star, Medal, Download
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, 
  Cell, LineChart, Line, CartesianGrid, Legend 
} from 'recharts';

import { 
  SessionAnalyticsDto, SessionListItemDto, 
  SessionLeaderboardEntryDto, StudentDrilldownDto 
} from '@classroom-quiz/shared';

type TabType = 'overview' | 'questions' | 'students' | 'matrix' | 'history';

export default function SessionDashboard() {
  const { sessionId, quizId } = useParams<{ sessionId?: string; quizId?: string }>();
  const navigate = useNavigate();
  const token = useAuthStore((state) => state.token);

  // States for main analytics payload
  const [data, setData] = useState<(SessionAnalyticsDto & { quizId: string; quizTitle: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Drilldown student selection
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  // Leaderboard sorting states
  const [sortField, setSortField] = useState<keyof SessionLeaderboardEntryDto>('rank');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Session history states
  const [history, setHistory] = useState<SessionListItemDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Download loading states
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadingCsv, setDownloadingCsv] = useState(false);

  const handleDownloadPdf = async () => {
    if (!sessionId) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/quizzes/sessions/${sessionId}/export/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate PDF report');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-session-${data?.joinCode || 'summary'}-report.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Error exporting PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleDownloadCsv = async () => {
    if (!sessionId) return;
    setDownloadingCsv(true);
    try {
      const res = await fetch(`/api/quizzes/sessions/${sessionId}/export/csv`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate CSV results');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quiz-session-${data?.joinCode || 'results'}-results.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(err.message || 'Error exporting CSV');
    } finally {
      setDownloadingCsv(false);
    }
  };

  // Fetch Session Analytics
  const fetchAnalytics = async (sId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/quizzes/sessions/${sId}/analytics`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load session analytics');
      
      setData(json.data);
      // Auto-select first student if available
      if (json.data.participants && json.data.participants.length > 0) {
        setSelectedStudentId(json.data.participants[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred loading reports.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch Session History for comparison
  const fetchSessionHistory = async (quizId: string) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/sessions`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load past sessions');
      setHistory(json.data.sessions);
    } catch (err: any) {
      setHistoryError(err.message || 'Failed to load history trends.');
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId && token) {
      fetchAnalytics(sessionId);
    } else if (quizId && token) {
      // History-only mode when no active sessionId is inspected
      setData({
        quizId,
        quizTitle: 'Quiz Session History',
        joinCode: '',
        mode: 'LIVE',
        overview: {
          totalParticipants: 0,
          completionRate: 0,
          averageScore: 0,
          averageAccuracy: 0,
          averageResponseTimeSec: 0,
          fastestPlayer: null,
          hardestQuestion: null
        },
        leaderboard: [],
        perQuestion: {
          heatmap: [],
          questions: []
        },
        responseMatrix: {
          questions: [],
          matrix: []
        },
        participants: []
      });
      setActiveTab('history');
      setLoading(false);
    }
  }, [sessionId, quizId, token]);

  // Fetch history when history tab is clicked
  useEffect(() => {
    if (activeTab === 'history' && data?.quizId) {
      fetchSessionHistory(data.quizId);
    }
  }, [activeTab, data?.quizId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="w-12 h-12 text-indigo-400 animate-spin" />
          <p className="text-slate-400 font-semibold">Generating analytics dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white p-6">
        <div className="glass-card max-w-md p-8 rounded-2xl text-center shadow-glow border-red-500/20">
          <ShieldAlert className="w-14 h-14 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-display mb-2">Failed to load reports</h2>
          <p className="text-slate-400 text-sm mb-6 font-medium">{error || 'Session report not found.'}</p>
          <Link 
            to="/host/dashboard" 
            className="inline-block bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-2.5 px-6 rounded-xl transition-all text-sm shadow-md"
          >
            Back to Host Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { overview, leaderboard, perQuestion, responseMatrix, participants } = data;

  // Sorting Leaderboard
  const handleSort = (field: keyof SessionLeaderboardEntryDto) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'rank' || field === 'avgResponseTimeSec' ? 'asc' : 'desc');
    }
  };

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (typeof aVal === 'string') {
      return sortOrder === 'asc' 
        ? (aVal as string).localeCompare(bVal as string)
        : (bVal as string).localeCompare(aVal as string);
    }
    
    return sortOrder === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  // Selected Student Drilldown
  const activeStudent = participants.find(p => p.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Header */}
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
              <div className="flex items-center gap-2">
                <span className="text-xs text-indigo-400 font-bold uppercase tracking-widest">Session Reports</span>
                {data.mode && (
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                    data.mode === 'HOMEWORK' 
                      ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' 
                      : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  }`}>
                    {data.mode}
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold font-display tracking-tight mt-0.5 text-glow">{data.quizTitle}</h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {sessionId && (
              <div className="flex gap-2">
                <button
                  onClick={handleDownloadCsv}
                  disabled={downloadingCsv}
                  className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-750 text-slate-350 hover:text-white font-bold py-1.5 px-3 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Export results to CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingCsv ? 'CSV...' : 'CSV'}
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={downloadingPdf}
                  className="bg-indigo-500 hover:bg-indigo-650 text-white font-bold py-1.5 px-3 rounded-xl transition-all text-xs flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                  title="Export summary report to PDF"
                >
                  <Download className="w-3.5 h-3.5" />
                  {downloadingPdf ? 'PDF...' : 'PDF'}
                </button>
              </div>
            )}
            
            {data.joinCode && (
              <div className="bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-400">
                Join Code: <strong className="text-white font-black">{data.joinCode}</strong>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Tabs Switcher */}
      <nav className="max-w-7xl mx-auto px-6 mb-8">
        <div className="flex bg-slate-900/60 p-1.5 rounded-xl border border-slate-850 max-w-2xl overflow-x-auto gap-1">
          {[
            { id: 'overview', label: 'Overview', icon: <Trophy className="w-4 h-4" /> },
            { id: 'questions', label: 'Questions', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'students', label: 'Student Report', icon: <User className="w-4 h-4" /> },
            { id: 'matrix', label: 'Response Matrix', icon: <Grid className="w-4 h-4" /> },
            { id: 'history', label: 'History & Trends', icon: <TrendingUp className="w-4 h-4" /> },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as TabType)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 select-none ${
                activeTab === t.id
                  ? 'bg-indigo-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-850'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Tab Contents */}
      <main className="max-w-7xl mx-auto px-6">
        {activeTab !== 'history' && participants.length === 0 ? (
          <div className="text-center py-20 text-slate-500 border border-dashed border-slate-850 rounded-2xl bg-slate-950/20 max-w-xl mx-auto">
            <Users className="w-12 h-12 text-slate-750 mx-auto mb-3" />
            <p className="font-semibold text-sm">No player submissions registered yet.</p>
            <p className="text-xs text-slate-650 mt-1">Classroom analytics will populate here once students join and answer questions.</p>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {activeTab === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                {/* KPI Cards Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                  {[
                    { label: 'Participants', value: overview.totalParticipants, desc: 'Students joined', icon: <Users className="w-4 h-4 text-indigo-400" /> },
                    { label: 'Completion', value: `${overview.completionRate}%`, desc: 'Questions answered', icon: <Percent className="w-4 h-4 text-emerald-400" /> },
                    { label: 'Avg Score', value: overview.averageScore, desc: 'Points per student', icon: <Trophy className="w-4 h-4 text-yellow-400" /> },
                    { label: 'Avg Accuracy', value: `${overview.averageAccuracy}%`, desc: 'Correct responses', icon: <Check className="w-4 h-4 text-green-400" /> },
                    { label: 'Avg Speed', value: `${overview.averageResponseTimeSec}s`, desc: 'Seconds per answer', icon: <Clock className="w-4 h-4 text-blue-400" /> },
                    { label: 'Fastest Correct', value: overview.fastestPlayer ? overview.fastestPlayer.displayName : 'N/A', desc: overview.fastestPlayer ? `${overview.fastestPlayer.avgResponseTimeSec}s avg` : 'No correct answers', icon: <Star className="w-4 h-4 text-orange-400" /> },
                    { label: 'Hardest Question', value: overview.hardestQuestion ? `Q${overview.hardestQuestion.order}` : 'N/A', desc: overview.hardestQuestion ? `${overview.hardestQuestion.accuracy}% accuracy` : 'No data', icon: <X className="w-4 h-4 text-red-400" /> },
                  ].map((card, idx) => (
                    <div key={idx} className="glass-card p-5 rounded-2xl border-slate-800 flex flex-col justify-between shadow-sm">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{card.label}</span>
                        <div className="p-1 rounded bg-slate-900 border border-slate-800">{card.icon}</div>
                      </div>
                      <div>
                        <h2 className="text-xl font-extrabold tracking-tight">{card.value}</h2>
                        <span className="text-[9px] text-slate-400 block truncate mt-0.5">{card.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Final Leaderboard */}
                <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md">
                  <h2 className="text-lg font-bold font-display tracking-tight flex items-center gap-2 mb-6 text-indigo-400">
                    <Trophy className="w-5 h-5" /> Final Leaderboard Standings
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none">
                          {[
                            { field: 'rank', label: 'Rank' },
                            { field: 'displayName', label: 'Student Name' },
                            { field: 'score', label: 'Final Score' },
                            { field: 'accuracy', label: 'Accuracy' },
                            { field: 'avgResponseTimeSec', label: 'Avg Speed' },
                          ].map((col) => (
                            <th 
                              key={col.field}
                              onClick={() => handleSort(col.field as any)}
                              className="pb-3 cursor-pointer hover:text-white transition-colors"
                            >
                              <div className="flex items-center gap-1">
                                {col.label}
                                {sortField === col.field && (sortOrder === 'asc' ? '▲' : '▼')}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/65 font-medium">
                        {sortedLeaderboard.map((row) => (
                          <tr key={row.displayName} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3.5 font-bold text-slate-400">#{row.rank}</td>
                            <td className="py-3.5 font-extrabold text-white">{row.displayName}</td>
                            <td className="py-3.5 text-indigo-400 font-black">{row.score} pts</td>
                            <td className="py-3.5">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                                row.accuracy >= 80 
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                                  : row.accuracy >= 50 
                                  ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400' 
                                  : 'bg-red-500/10 border-red-500/20 text-red-400'
                              }`}>
                                {row.accuracy}%
                              </span>
                            </td>
                            <td className="py-3.5 text-slate-300 font-semibold">{row.avgResponseTimeSec}s</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* QUESTIONS TAB */}
            {activeTab === 'questions' && (
              <div className="space-y-8 animate-fade-in">
                {/* Heatmap summary */}
                <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Difficulty Heatmap</h3>
                  <div className="flex flex-wrap gap-2.5">
                    {perQuestion.heatmap.map((q) => {
                      const color = q.accuracy >= 80 
                        ? 'bg-emerald-500 border-emerald-600 shadow-emerald-500/10 text-slate-950' 
                        : q.accuracy >= 50 
                        ? 'bg-yellow-500 border-yellow-600 shadow-yellow-500/10 text-slate-950' 
                        : 'bg-red-500 border-red-600 shadow-red-500/10 text-white';
                      return (
                        <a 
                          href={`#question-${q.id}`}
                          key={q.id}
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xs font-black border-b-4 hover:scale-[1.05] transition-all shadow-sm ${color}`}
                          title={`Q${q.order}: ${q.accuracy}% accuracy`}
                        >
                          Q{q.order}
                        </a>
                      );
                    })}
                  </div>
                </div>

                {/* List of Questions with Charts */}
                <div className="space-y-6">
                  {perQuestion.questions.map((q) => (
                    <div 
                      id={`question-${q.id}`} 
                      key={q.id}
                      className="glass-card p-6 rounded-2xl border-slate-800/80 scroll-mt-24 flex flex-col lg:flex-row gap-8 shadow-md"
                    >
                      {/* Left: Detail Card */}
                      <div className="lg:w-1/3 flex flex-col justify-between space-y-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-indigo-500/15 text-indigo-400 text-[10px] px-2.5 py-1 rounded-lg font-black uppercase tracking-wider">
                              Q{q.order} ({q.type.replace('_', ' ')})
                            </span>
                            {q.mostMissed && (
                              <span className="bg-red-500/15 border border-red-500/25 text-red-400 text-[10px] px-2 py-0.5 rounded-lg font-bold flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                Hardest
                              </span>
                            )}
                          </div>
                          <h3 className="font-display font-bold text-lg text-white leading-snug">
                            {q.text}
                          </h3>
                        </div>

                        <div className="grid grid-cols-2 gap-4 border-t border-slate-850 pt-4">
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Accuracy Rate</span>
                            <span className={`text-xl font-black ${
                              q.accuracy >= 80 ? 'text-emerald-400' : q.accuracy >= 50 ? 'text-yellow-400' : 'text-red-400'
                            }`}>{q.accuracy}%</span>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">Avg Response Speed</span>
                            <span className="text-xl font-black text-slate-350">{q.avgResponseTimeSec}s</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Bar Chart Option distribution */}
                      <div className="flex-1 min-h-56">
                        <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider block mb-3">Choice Distribution</span>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart 
                            data={q.optionsDistribution} 
                            margin={{ top: 5, right: 10, left: -20, bottom: 5 }}
                          >
                            <XAxis 
                              dataKey="text" 
                              stroke="#64748b" 
                              fontSize={10} 
                              fontWeight="bold"
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              allowDecimals={false}
                              stroke="#64748b" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                              contentStyle={{ 
                                backgroundColor: '#090d16', 
                                border: '1px solid #1e293b', 
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#fff'
                              }}
                            />
                            <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                              {q.optionsDistribution.map((entry, index) => (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={entry.isCorrect ? '#10b981' : '#ef4444'} 
                                  fillOpacity={entry.isCorrect ? 0.7 : 0.3}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STUDENT DRILLDOWN TAB */}
            {activeTab === 'students' && (
              <div className="space-y-6 animate-fade-in">
                {/* Select student dropdown banner */}
                <div className="glass-card p-6 rounded-2xl border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <User className="w-5 h-5 text-indigo-400" />
                    <div>
                      <h3 className="font-bold text-sm">Student Drilldown Report</h3>
                      <p className="text-xs text-slate-400 font-medium">Select a participant to review their response timeline</p>
                    </div>
                  </div>

                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 font-bold text-sm shadow-md"
                  >
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.displayName}</option>
                    ))}
                  </select>
                </div>

                {activeStudent && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Summary panel */}
                    <div className="lg:col-span-1 space-y-6">
                      <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md text-center space-y-6">
                        <div className="w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 mx-auto">
                          <User className="w-8 h-8" />
                        </div>

                        <div>
                          <h2 className="text-xl font-extrabold font-display">{activeStudent.displayName}</h2>
                          <span className="text-xs text-slate-500 font-bold block mt-1">Accuracy Score: {activeStudent.accuracy}%</span>
                        </div>

                        <div className="border-t border-slate-850 pt-5 text-left space-y-4">
                          <h4 className="text-xs font-black uppercase tracking-wider text-slate-450">Slowest Answers</h4>
                          {activeStudent.slowestQuestions.length === 0 ? (
                            <p className="text-xs text-slate-500">No slowest questions found.</p>
                          ) : (
                            <div className="space-y-3">
                              {activeStudent.slowestQuestions.map((s, idx) => (
                                <div key={idx} className="bg-slate-950/40 border border-slate-850 p-3.5 rounded-xl text-xs space-y-1 shadow-sm">
                                  <p className="font-semibold text-slate-350 truncate">{s.questionText}</p>
                                  <div className="flex justify-between items-center text-[10px] text-slate-500">
                                    <span>Time: <strong>{s.responseTimeSec}s</strong></span>
                                    <span className={s.isCorrect ? 'text-emerald-400' : 'text-red-400'}>
                                      {s.isCorrect ? 'Correct' : 'Incorrect'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Answers timeline */}
                    <div className="lg:col-span-2 glass-card p-6 rounded-2xl border-slate-800/80 shadow-md">
                      <h3 className="text-sm font-bold font-display tracking-tight flex items-center gap-2 mb-6 text-indigo-400">
                        <FileText className="w-4.5 h-4.5" /> Response Timeline
                      </h3>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider">
                              <th className="pb-3">Q#</th>
                              <th className="pb-3">Question Text</th>
                              <th className="pb-3">Selected Choice</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3">Speed</th>
                              <th className="pb-3">Points</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/60 font-medium">
                            {activeStudent.answers.map((ans) => (
                              <tr key={ans.questionId} className="hover:bg-slate-900/20">
                                <td className="py-4 font-bold text-slate-400">Q{ans.order}</td>
                                <td className="py-4 font-bold text-white max-w-[200px] truncate" title={ans.text}>{ans.text}</td>
                                <td className="py-4 text-slate-300 font-semibold max-w-[150px] truncate" title={ans.selectedOptionText}>{ans.selectedOptionText}</td>
                                <td className="py-4">
                                  {ans.isCorrect ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                      <Check className="w-3.5 h-3.5" /> Correct
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-lg text-[10px] font-black">
                                      <X className="w-3.5 h-3.5" /> Incorrect
                                    </span>
                                  )}
                                </td>
                                <td className="py-4 font-semibold text-slate-300">{ans.responseTimeSec}s</td>
                                <td className="py-4 font-black text-indigo-400">{ans.pointsAwarded} pts</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RESPONSE MATRIX TAB */}
            {activeTab === 'matrix' && (
              <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md space-y-6 animate-fade-in">
                <div className="border-b border-slate-850 pb-4">
                  <h2 className="text-lg font-bold font-display tracking-tight flex items-center gap-2 text-indigo-400">
                    <Grid className="w-5 h-5" /> Student Response Matrix
                  </h2>
                  <p className="text-xs text-slate-400 font-medium mt-1">Review at-a-glance correctness cells. Hover over cells for selection details.</p>
                </div>

                <div className="overflow-x-auto pr-1">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-500 font-black uppercase text-[10px] tracking-wider select-none">
                        <th className="pb-3 text-left pl-2">Student Name</th>
                        <th className="pb-3 text-right pr-6">Score</th>
                        {responseMatrix.questions.map((mq) => (
                          <th 
                            key={mq.id} 
                            className="pb-3 text-center min-w-12 max-w-16 truncate"
                            title={`Q${mq.order}: ${mq.text}`}
                          >
                            Q{mq.order}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/65 font-bold">
                      {responseMatrix.matrix.map((row) => (
                        <tr key={row.participantId} className="hover:bg-slate-900/30">
                          <td className="py-3.5 text-left text-white font-extrabold pl-2 truncate max-w-[120px]">{row.displayName}</td>
                          <td className="py-3.5 text-right pr-6 font-black text-indigo-400">{row.finalScore}</td>
                          {row.answers.map((cell) => {
                            let cellBg = 'bg-slate-900 text-slate-650';
                            let titleText = 'No answer submitted';
                            if (cell.isCorrect === true) {
                              cellBg = 'bg-emerald-500/15 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/35';
                              titleText = `Correct! Choice: "${cell.selectedOptionText}" (${cell.responseTimeSec}s)`;
                            } else if (cell.isCorrect === false) {
                              cellBg = 'bg-red-500/15 border-red-500/20 text-red-400 hover:bg-red-500/35';
                              titleText = `Incorrect! Choice: "${cell.selectedOptionText}" (${cell.responseTimeSec}s)`;
                            }
                            return (
                              <td key={cell.questionId} className="py-2 px-1 text-center select-none">
                                <div 
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center mx-auto border transition-all cursor-help ${cellBg}`}
                                  title={titleText}
                                >
                                  {cell.isCorrect === true && <Check className="w-3.5 h-3.5" />}
                                  {cell.isCorrect === false && <X className="w-3.5 h-3.5" />}
                                  {cell.isCorrect === null && <span className="text-[10px] font-black">•</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SESSION HISTORY TAB */}
            {activeTab === 'history' && (
              <div className="space-y-6 animate-fade-in">
                {historyError && (
                  <div className="bg-red-500/10 border border-red-550/20 text-red-250 p-4 rounded-xl flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                    <span className="text-sm font-semibold">{historyError}</span>
                  </div>
                )}

                {historyLoading ? (
                  <div className="text-center py-10">
                    <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mt-2">Loading session history...</p>
                  </div>
                ) : (
                  <>
                    {/* Performance Trends Chart */}
                    <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Performance Trends Over Time</h3>
                      
                      <div className="h-64 min-w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={history.map((h, idx) => ({
                              name: `Session ${idx + 1}`,
                              code: h.joinCode,
                              Score: h.averageScore,
                              Accuracy: h.averageAccuracy
                            }))}
                            margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.2} />
                            <XAxis 
                              dataKey="name" 
                              stroke="#64748b" 
                              fontSize={10} 
                              fontWeight="bold"
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={10}
                              tickLine={false}
                              axisLine={false}
                            />
                            <Tooltip
                              contentStyle={{ 
                                backgroundColor: '#090d16', 
                                border: '1px solid #1e293b', 
                                borderRadius: '12px',
                                fontSize: '12px',
                                color: '#fff'
                              }}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', fontWeight: 'bold' }} />
                            <Line 
                              type="monotone" 
                              dataKey="Accuracy" 
                              stroke="#10b981" 
                              strokeWidth={3} 
                              dot={{ r: 4, stroke: '#10b981', strokeWidth: 2, fill: '#090d16' }}
                              activeDot={{ r: 6 }} 
                              unit="%"
                            />
                            <Line 
                              type="monotone" 
                              dataKey="Score" 
                              stroke="#4f46e5" 
                              strokeWidth={3} 
                              dot={{ r: 4, stroke: '#4f46e5', strokeWidth: 2, fill: '#090d16' }}
                              activeDot={{ r: 6 }}
                              unit=" pts"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Past Sessions List */}
                    <div className="glass-card p-6 rounded-2xl border-slate-800/80 shadow-md">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Historical Sessions</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-850 text-slate-500 font-black uppercase tracking-wider">
                              <th className="pb-3">Date Run</th>
                              <th className="pb-3">Join Code</th>
                              <th className="pb-3">Mode</th>
                              <th className="pb-3">Status</th>
                              <th className="pb-3">Participants</th>
                              <th className="pb-3">Average Score</th>
                              <th className="pb-3">Average Accuracy</th>
                              <th className="pb-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850/60 font-semibold">
                            {history.map((s) => {
                              const isCurrent = s.sessionId === sessionId;
                              return (
                                <tr key={s.sessionId} className={`hover:bg-slate-900/30 ${isCurrent ? 'bg-indigo-500/5' : ''}`}>
                                  <td className="py-4 text-slate-300">
                                    <div className="flex items-center gap-2">
                                      <Calendar className="w-4 h-4 text-indigo-400" />
                                      <span>{new Date(s.startedAt).toLocaleDateString()} at {new Date(s.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    </div>
                                  </td>
                                  <td className="py-4 text-white font-extrabold">{s.joinCode}</td>
                                  <td className="py-4">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                      s.mode === 'HOMEWORK' 
                                        ? 'bg-purple-500/10 border border-purple-500/20 text-purple-400' 
                                        : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                                    }`}>
                                      {s.mode}
                                    </span>
                                  </td>
                                  <td className="py-4">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${
                                      s.status === 'ENDED' 
                                        ? 'bg-slate-900 border border-slate-850 text-slate-500' 
                                        : s.status === 'LIVE' 
                                        ? 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400' 
                                        : 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                                    }`}>
                                      {s.status}
                                    </span>
                                  </td>
                                  <td className="py-4 text-slate-350">{s.totalParticipants} students</td>
                                  <td className="py-4 text-indigo-400 font-extrabold">{s.averageScore} pts</td>
                                  <td className="py-4 text-emerald-400 font-extrabold">{s.averageAccuracy}%</td>
                                  <td className="py-4 text-right">
                                    {isCurrent ? (
                                      <span className="text-[10px] text-indigo-400 font-black uppercase tracking-wider pr-4">Active</span>
                                    ) : (
                                      <button
                                        onClick={() => {
                                          setActiveTab('overview');
                                          fetchAnalytics(s.sessionId);
                                          navigate(`/host/sessions/${s.sessionId}/analytics`);
                                        }}
                                        className="text-xs text-indigo-400 hover:text-white bg-slate-900 border border-slate-850 hover:border-slate-700 px-3 py-1.5 rounded-xl transition-all"
                                      >
                                        Inspect Report
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
