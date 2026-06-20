import React, { useState } from 'react';
import { useQuizStore } from '../store/quizStore.js';
import { X, ClipboardPaste, AlertCircle, CheckCircle2, ChevronRight, HelpCircle } from 'lucide-react';

interface BulkPasteModalProps {
  quizId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkPasteModal({ quizId, onClose, onSuccess }: BulkPasteModalProps) {
  const { validateImport, commitImport } = useQuizStore();
  
  const [content, setContent] = useState('');
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleValidate = async () => {
    if (!content.trim()) return;

    setIsValidating(true);
    setError(null);
    setReport(null);
    try {
      const data = await validateImport(quizId, 'paste', content);
      setReport(data);
    } catch (err: any) {
      setError(err.message || 'Failed to parse paste text. Check formatting.');
    } finally {
      setIsValidating(false);
    }
  };

  const handleImport = async () => {
    if (!report || report.validQuestions.length === 0) return;

    setIsImporting(true);
    setError(null);
    try {
      await commitImport(quizId, report.validQuestions);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to import questions to database.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-3xl max-h-[85vh] p-8 rounded-2xl shadow-glow flex flex-col relative animate-scale-in">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <ClipboardPaste className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold font-display tracking-tight">Bulk Paste Question Importer</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-900 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto my-6 pr-2 space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          )}

          {!report ? (
            /* Input Form */
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-3 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Paste Questions & Options below
                  </label>
                  <textarea
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Which HTML tag is used for line breaks?&#10;A) <lb>&#10;*B) <br>&#10;C) <break>&#10;D) <a>&#10;&#10;Cascading Style Sheets is abbreviated as CSS.&#10;*A) True&#10;B) False"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-mono text-sm placeholder:text-slate-700 resize-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={isValidating || !content.trim()}
                  onClick={handleValidate}
                  className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isValidating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    'Parse & Preview'
                  )}
                </button>
              </div>

              <div className="md:col-span-2 bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-4 text-sm">
                <h3 className="font-bold flex items-center gap-1.5 text-slate-300">
                  <HelpCircle className="w-4 h-4 text-indigo-400" /> Formatting Guide
                </h3>
                <ul className="space-y-3.5 text-slate-400 text-xs font-medium">
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>Separate blocks of questions with an <strong>empty line</strong>.</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>The <strong>first line</strong> represents the question text.</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>Options must start with letter prefixes: <code>A)</code> or <code>A.</code>.</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>Prefix the single correct choice with an asterisk <strong><code>*</code></strong> (e.g. <code>*B) Choice text</code>).</span>
                  </li>
                  <li className="flex gap-2">
                    <ChevronRight className="w-4 h-4 shrink-0 text-indigo-500" />
                    <span>True/False questions are auto-detected if options are exactly <strong>True</strong> and <strong>False</strong>.</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            /* Report / Confirm View */
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/25 p-4 rounded-xl text-center">
                  <span className="block text-2xl font-black text-emerald-400">{report.validCount}</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valid Questions</span>
                </div>
                <div className="bg-red-500/5 border border-red-550/25 p-4 rounded-xl text-center">
                  <span className="block text-2xl font-black text-red-400">{report.invalidCount}</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Failed Questions</span>
                </div>
              </div>

              {/* Errors report */}
              {report.errors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-red-400 uppercase tracking-wider">Parsing Errors</h3>
                  <div className="border border-red-500/20 bg-red-500/5 rounded-xl divide-y divide-red-500/10 max-h-48 overflow-y-auto">
                    {report.errors.map((err: any, idx: number) => (
                      <div key={idx} className="p-4 text-xs font-semibold">
                        <span className="text-red-400 font-black">Block {err.row}:</span>{' '}
                        <span className="text-slate-300 italic">"{err.questionText}"</span>
                        <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
                          {err.errors.map((eStr: string, iIdx: number) => (
                            <li key={iIdx}>{eStr}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Valid questions preview */}
              {report.validQuestions.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">Questions Preview ({report.validQuestions.length})</h3>
                  <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/80 max-h-60 overflow-y-auto bg-slate-900/30">
                    {report.validQuestions.map((q: any, idx: number) => (
                      <div key={idx} className="p-4 flex gap-4 text-xs">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <p className="font-bold text-white text-sm">{q.text}</p>
                          <div className="flex flex-wrap gap-2 pt-1.5">
                            {q.options.map((opt: any, oIdx: number) => (
                              <span 
                                key={oIdx}
                                className={`px-2.5 py-1 rounded-md border font-semibold ${
                                  opt.isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-slate-900 border-slate-850 text-slate-500'
                                }`}
                              >
                                {opt.text}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
          {report ? (
            /* Confirm Actions */
            <>
              <button
                type="button"
                onClick={() => setReport(null)}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
              >
                Back to Edit
              </button>
              <button
                type="button"
                disabled={isImporting || report.validQuestions.length === 0}
                onClick={handleImport}
                className="bg-indigo-500 hover:bg-indigo-650 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  `Import ${report.validQuestions.length} Questions`
                )}
              </button>
            </>
          ) : (
            /* Input Actions */
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
