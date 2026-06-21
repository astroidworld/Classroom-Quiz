import React, { useState, useRef } from 'react';
import { useQuizStore } from '../store/quizStore.js';
import { X, FileSpreadsheet, AlertCircle, CheckCircle2, FileUp, Info } from 'lucide-react';

interface CSVImportModalProps {
  quizId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CSVImportModal({ quizId, onClose, onSuccess }: CSVImportModalProps) {
  const { validateImport, commitImport } = useQuizStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [report, setReport] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const [isDragActive, setIsDragActive] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const parseFileAndValidate = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Please select a valid CSV spreadsheet file (.csv).');
      return;
    }

    setFileName(file.name);
    setError(null);
    setReport(null);
    setIsValidating(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        const data = await validateImport(quizId, 'csv', text);
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'CSV validation failed. Check headers formatting.');
      } finally {
        setIsValidating(false);
      }
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
      setIsValidating(false);
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseFileAndValidate(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      parseFileAndValidate(e.target.files[0]);
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
      setError(err.message || 'Failed to import CSV questions to database.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="glass-card w-full max-w-3xl max-h-[85vh] p-8 rounded-2xl shadow-glow flex flex-col relative animate-scale-in">
        <div className="flex justify-between items-center pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold font-display tracking-tight">Upload CSV Spreadsheet</h2>
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
            /* Upload Box */
            <div className="space-y-6">
              <div 
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3 ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/15'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange}
                  accept=".csv"
                  className="hidden" 
                />
                
                {isValidating ? (
                  <>
                    <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-slate-400 font-semibold text-sm">Validating spreadsheet rows...</p>
                  </>
                ) : (
                  <>
                    <FileUp className="w-12 h-12 text-slate-650" />
                    <p className="text-slate-300 font-bold text-sm">
                      {fileName ? fileName : 'Drag & drop your CSV file here, or click to browse'}
                    </p>
                    <p className="text-slate-500 text-xs font-semibold">Only .csv spreadsheet files are accepted</p>
                  </>
                )}
              </div>

              {/* Guidelines */}
              <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-2xl space-y-3.5">
                <h3 className="font-bold flex items-center gap-1.5 text-xs uppercase tracking-wider text-indigo-400">
                  <Info className="w-4 h-4" /> Header Specification Required
                </h3>
                <p className="text-slate-400 text-xs font-medium leading-relaxed">
                  Your CSV file columns must match the following template exactly:
                </p>
                <div className="bg-slate-950 p-3 rounded-lg text-slate-300 font-mono text-[10px] overflow-x-auto select-all border border-slate-850">
                  question,option_a,option_b,option_c,option_d,correct_option,time_limit,points,code_snippet,code_language
                </div>
                <p className="text-slate-500 text-[11px] font-medium italic">
                  * Note: correct_option letters must match options (A, B, C, or D). option_c, option_d, code_snippet, and code_language can be left empty.
                </p>
              </div>
            </div>
          ) : (
            /* Report / Confirm View */
            <div className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-500/5 border border-emerald-500/25 p-4 rounded-xl text-center">
                  <span className="block text-2xl font-black text-emerald-400">{report.validCount}</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Valid Rows</span>
                </div>
                <div className="bg-red-500/5 border border-red-550/25 p-4 rounded-xl text-center">
                  <span className="block text-2xl font-black text-red-400">{report.invalidCount}</span>
                  <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Invalid Rows (Skipped)</span>
                </div>
              </div>

              {/* Errors report */}
              {report.errors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-red-400 uppercase tracking-wider">Row Errors Report</h3>
                  <div className="border border-red-500/20 bg-red-500/5 rounded-xl divide-y divide-red-500/10 max-h-48 overflow-y-auto">
                    {report.errors.map((err: any, idx: number) => (
                      <div key={idx} className="p-4 text-xs font-semibold">
                        <span className="text-red-400 font-black">Row {err.row}:</span>{' '}
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
                  <h3 className="font-bold text-sm text-slate-300 uppercase tracking-wider">Valid Questions Preview ({report.validQuestions.length})</h3>
                  <div className="border border-slate-800 rounded-xl divide-y divide-slate-800/80 max-h-60 overflow-y-auto bg-slate-900/30">
                    {report.validQuestions.map((q: any, idx: number) => (
                      <div key={idx} className="p-4 flex gap-4 text-xs">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-1.5">
                          <p className="font-bold text-white text-sm">{q.text}</p>
                          {q.codeSnippet && (
                            <div className="mt-2 p-2 bg-slate-950/80 rounded border border-slate-850 font-mono text-[10px] text-slate-400 whitespace-pre overflow-x-auto leading-relaxed max-w-full">
                              <span className="text-indigo-400 font-bold block mb-1">[{q.codeLanguage.toUpperCase()}] Preview:</span>
                              {q.codePreview}
                            </div>
                          )}
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
                onClick={() => {
                  setReport(null);
                  setFileName(null);
                }}
                className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
              >
                Upload New File
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
                  `Import ${report.validQuestions.length} Valid Rows`
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
