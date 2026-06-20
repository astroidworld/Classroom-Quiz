import React from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { Users, Volume2, VolumeX, RefreshCw, LogOut } from 'lucide-react';

export default function StudentLobby() {
  const { roomCode, displayName, players, isMuted, setMute, resetGame } = useSocketStore();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-white relative">
      {/* Mute and Logout Top Header */}
      <div className="absolute top-6 right-6 flex items-center gap-3">
        <button
          onClick={() => setMute(!isMuted)}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-400 hover:text-white"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
        <button
          onClick={resetGame}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 hover:text-red-400 rounded-xl transition-all text-slate-400"
          title="Exit Room"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <div className="glass-card w-full max-w-lg p-8 rounded-2xl shadow-glow text-center space-y-6">
        <div>
          <span className="bg-indigo-500/15 text-indigo-400 text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest">
            Lobby Waiting Room
          </span>
          <h1 className="font-display text-4xl font-extrabold mt-3 tracking-tight">
            Room Code: <span className="text-indigo-400 text-glow">{roomCode}</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 font-medium">
            Connected as <strong className="text-white font-bold">{displayName}</strong>
          </p>
        </div>

        {/* Waiting spinner */}
        <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-xl flex flex-col items-center gap-3 justify-center">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
            Waiting for teacher to start the quiz...
          </p>
        </div>

        {/* Players count and grid */}
        <div className="space-y-4 text-left">
          <div className="flex items-center gap-2 text-slate-350 text-xs font-black uppercase tracking-wider border-b border-slate-850 pb-2">
            <Users className="w-4 h-4 text-indigo-400" />
            <span>Players in Lobby ({players.length})</span>
          </div>

          <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            {players.map((p) => (
              <span
                key={p.id}
                className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${
                  p.displayName === displayName
                    ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400 shadow-glow font-extrabold'
                    : p.isOnline
                    ? 'bg-slate-900 border-slate-850 text-slate-300'
                    : 'bg-slate-950 border-slate-900 text-slate-600 line-through'
                }`}
              >
                {p.displayName} {p.displayName === displayName && '(You)'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
