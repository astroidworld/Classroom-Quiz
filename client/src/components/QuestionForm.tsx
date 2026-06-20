import React, { useState, useEffect } from 'react';
import { QuestionDto, OptionDto } from '@classroom-quiz/shared';
import { Save, X, Plus, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface QuestionFormProps {
  question?: QuestionDto | null;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
}

export default function QuestionForm({ question, onSave, onCancel }: QuestionFormProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<'MCQ_SINGLE' | 'TRUE_FALSE'>('MCQ_SINGLE');
  const [imageUrl, setImageUrl] = useState('');
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [points, setPoints] = useState(1000);
  const [explanation, setExplanation] = useState('');
  
  const [options, setOptions] = useState<Omit<OptionDto, 'id'>[]>([
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize fields if editing an existing question
  useEffect(() => {
    if (question) {
      setText(question.text);
      setType(question.type);
      setImageUrl(question.imageUrl || '');
      setTimeLimitSec(question.timeLimitSec);
      setPoints(question.points);
      setExplanation(question.explanation || '');
      setOptions(question.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })));
      setError(null);
    } else {
      // Defaults
      setText('');
      setType('MCQ_SINGLE');
      setImageUrl('');
      setTimeLimitSec(null);
      setPoints(1000);
      setExplanation('');
      setOptions([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
      setError(null);
    }
  }, [question]);

  // Adjust options automatically when type changes
  const handleTypeChange = (newType: 'MCQ_SINGLE' | 'TRUE_FALSE') => {
    setType(newType);
    if (newType === 'TRUE_FALSE') {
      setOptions([
        { text: 'True', isCorrect: false },
        { text: 'False', isCorrect: false },
      ]);
    } else {
      setOptions([
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
        { text: '', isCorrect: false },
      ]);
    }
  };

  const handleOptionTextChange = (index: number, val: string) => {
    setOptions(options.map((opt, i) => i === index ? { ...opt, text: val } : opt));
  };

  const handleOptionMarkCorrect = (index: number) => {
    // Exactly one option is correct for MCQ_SINGLE / TRUE_FALSE
    setOptions(options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index,
    })));
  };

  const handleAddOption = () => {
    if (options.length >= 6) return;
    setOptions([...options, { text: '', isCorrect: false }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) return;
    const wasCorrect = options[index].isCorrect;
    const filtered = options.filter((_, i) => i !== index);
    
    // If we removed the correct option, set the first remaining one as correct
    if (wasCorrect && filtered.length > 0) {
      filtered[0].isCorrect = true;
    }
    setOptions(filtered);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!text.trim()) {
      setError('Question text is required.');
      return;
    }

    if (options.some(o => !o.text.trim())) {
      setError('All option choice text fields must be filled.');
      return;
    }

    const correctCount = options.filter(o => o.isCorrect).length;
    if (correctCount !== 1) {
      setError('You must select exactly one correct option.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        text,
        type,
        imageUrl: imageUrl.trim() || null,
        timeLimitSec: timeLimitSec || null,
        points: Number(points),
        explanation: explanation.trim() || null,
        options,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-card rounded-2xl p-6 border-slate-700/60 shadow-inner space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-800">
        <h3 className="font-display font-bold text-lg text-indigo-400">
          {question ? 'Edit Question' : 'Add New Question'}
        </h3>
        <button 
          type="button" 
          onClick={onCancel}
          className="text-slate-500 hover:text-slate-300 p-1.5 rounded-lg hover:bg-slate-900 transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}

      {/* Basic configurations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Question Text
          </label>
          <textarea
            required
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Which selector is used to target element classes in CSS?"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-600 resize-none"
          />
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Question Type
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleTypeChange('MCQ_SINGLE')}
                className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all ${
                  type === 'MCQ_SINGLE'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                Multiple Choice
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('TRUE_FALSE')}
                className={`flex-1 py-2 px-3 rounded-lg border font-bold text-xs transition-all ${
                  type === 'TRUE_FALSE'
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                True / False
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Time (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={timeLimitSec || ''}
                onChange={(e) => setTimeLimitSec(e.target.value ? Number(e.target.value) : null)}
                placeholder="Default"
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium placeholder:text-slate-600 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Points
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                value={points}
                onChange={(e) => setPoints(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all font-medium text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Choices section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Answer Choices (Exactly one must be checked green)
          </label>
          {type === 'MCQ_SINGLE' && options.length < 6 && (
            <button
              type="button"
              onClick={handleAddOption}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Choice
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map((opt, idx) => (
            <div 
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                opt.isCorrect
                  ? 'bg-emerald-500/5 border-emerald-500/40 shadow-glow'
                  : 'bg-slate-900/40 border-slate-850 hover:border-slate-800'
              }`}
            >
              <button
                type="button"
                onClick={() => handleOptionMarkCorrect(idx)}
                className={`w-6 h-6 rounded-full shrink-0 border flex items-center justify-center transition-all ${
                  opt.isCorrect
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : 'border-slate-700 hover:border-slate-500'
                }`}
                title="Mark as correct answer"
              >
                {opt.isCorrect && <CheckCircle2 className="w-4 h-4" />}
              </button>

              <input
                type="text"
                required
                disabled={type === 'TRUE_FALSE'}
                value={opt.text}
                onChange={(e) => handleOptionTextChange(idx, e.target.value)}
                placeholder={`Option choice ${idx + 1}...`}
                className={`w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all font-medium placeholder:text-slate-600 ${
                  type === 'TRUE_FALSE' ? 'opacity-70 font-semibold' : ''
                }`}
              />

              {type === 'MCQ_SINGLE' && options.length > 2 && (
                <button
                  type="button"
                  onClick={() => handleRemoveOption(idx)}
                  className="text-slate-600 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-850 transition-all shrink-0"
                  title="Remove Choice"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Advanced info: image and explanations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-850">
        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Optional Image URL
          </label>
          <input
            type="text"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="e.g. https://example.com/image.jpg"
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium placeholder:text-slate-600"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
            Explanation (Shown in Practise/Review)
          </label>
          <input
            type="text"
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Provide context explaining the correct answer..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm font-medium placeholder:text-slate-600"
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
        <button
          type="button"
          onClick={onCancel}
          className="bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:border-slate-700 text-slate-300 font-bold py-2.5 px-5 rounded-xl transition-all text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-indigo-500 hover:bg-indigo-650 disabled:opacity-50 text-white font-bold py-2.5 px-6 rounded-xl shadow-lg transition-all text-sm flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Question
            </>
          )}
        </button>
      </div>
    </form>
  );
}
