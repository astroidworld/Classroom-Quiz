import React, { useState, useEffect } from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { AlertCircle, HelpCircle, User, Hash, Play } from 'lucide-react';

export default function JoinRoom() {
  const { initializeConnection, joinRoom, error, resetGame } = useSocketStore();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    initializeConnection();
    
    // Auto-populate code if query param ?code=123456 is passed (e.g. from QR code scan)
    const codeParam = searchParams.get('code');
    if (codeParam) {
      setCode(codeParam.slice(0, 6));
    }
  }, [initializeConnection, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const roomCode = code.trim();
    const displayName = name.trim();

    if (!roomCode || roomCode.length !== 6 || isNaN(Number(roomCode))) {
      setLocalError('Please enter a valid 6-digit numeric room code.');
      return;
    }

    if (!displayName || displayName.length < 2 || displayName.length > 15) {
      setLocalError('Display name must be between 2 and 15 characters.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Validate code & get mode from server
      const valRes = await fetch('/api/sessions/join/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ joinCode: roomCode }),
      });
      const valJson = await valRes.json();
      if (!valRes.ok) throw new Error(valJson.message || 'Validation failed');
      
      const validation = valJson.data;
      if (!validation.valid) {
        setLocalError(validation.message || 'Invalid room code.');
        setIsSubmitting(false);
        return;
      }

      if (validation.mode === 'LIVE') {
        // Standard Live Socket.IO join
        joinRoom(roomCode, displayName);
      } else if (validation.mode === 'HOMEWORK') {
        // HTTP Homework join
        const joinRes = await fetch('/api/sessions/homework/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ joinCode: roomCode, displayName }),
        });
        const joinJson = await joinRes.json();
        if (!joinRes.ok) throw new Error(joinJson.message || 'Failed to join homework');
        
        navigate(`/play/homework/${joinJson.data.participantId}`);
      }
    } catch (err: any) {
      setLocalError(err.message || 'An error occurred joining the session.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white relative">
      {/* Decorative ambient blobs */}
      <div className="absolute top-1/4 left-1/4 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl -z-10"></div>
      <div className="absolute bottom-1/4 right-1/4 w-60 h-60 bg-violet-600/10 rounded-full blur-3xl -z-10"></div>

      <div className="glass-card w-full max-w-md p-8 rounded-2xl shadow-glow text-center">
        <h1 className="font-display text-4xl font-extrabold mb-2 tracking-tight text-white select-none">
          Classroom <span className="text-indigo-400 text-glow">Quiz</span>
        </h1>
        <p className="text-slate-400 mb-8 font-medium">Join your live classroom game</p>
        
        {(localError || error) && (
          <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl mb-6 flex items-start gap-3 text-left animate-fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
            <span className="text-sm font-semibold">{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-Digit Room Code" 
              maxLength={6} 
              className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-12 pr-4 py-3.5 text-center text-xl font-black tracking-widest uppercase text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:font-sans placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-650"
            />
          </div>

          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
            <input 
              type="text" 
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Display Name" 
              maxLength={15}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-xl pl-12 pr-4 py-3.5 text-center text-lg font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:font-medium placeholder:text-slate-650"
            />
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 disabled:opacity-50 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Play className="w-4.5 h-4.5 fill-white" />
                Join Game Room
              </>
            )}
          </button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-slate-800/80">
          <Link to="/login" className="text-slate-400 hover:text-indigo-400 text-xs font-bold uppercase tracking-wider transition-all">
            Are you a teacher? Host a Quiz
          </Link>
        </div>
      </div>
    </div>
  );
}
