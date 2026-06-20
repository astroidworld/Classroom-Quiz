import React from 'react';
import { useSocketStore } from '../store/socketStore.js';
import { Trophy, Flame, Volume2, VolumeX } from 'lucide-react';

export default function StudentLeaderboard() {
  const { leaderboard, displayName, isMuted, setMute } = useSocketStore();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 text-white relative">
      {/* Header Controls */}
      <div className="absolute top-6 right-6">
        <button
          onClick={() => setMute(!isMuted)}
          className="p-2.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl transition-all text-slate-400 hover:text-white"
          title={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>
      </div>

      <div className="glass-card w-full max-w-lg p-8 rounded-2xl shadow-glow text-center space-y-6">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
            <Trophy className="w-6 h-6 fill-current" />
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight mt-2 text-glow">Standings</h1>
          <p className="text-slate-400 text-xs font-semibold">How everyone is scoring in real-time</p>
        </div>

        {/* Leaderboard Table */}
        <div className="border border-slate-850 rounded-xl bg-slate-950/20 divide-y divide-slate-850/60 max-h-80 overflow-y-auto">
          {leaderboard.map((player) => {
            const isMe = player.displayName === displayName;
            return (
              <div 
                key={player.displayName}
                className={`p-4 flex items-center justify-between transition-all ${
                  isMe 
                    ? 'bg-indigo-500/10 font-bold' 
                    : player.isOnline 
                    ? '' 
                    : 'opacity-40'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Rank Badge */}
                  <span className={`w-6 text-center text-xs font-black select-none ${
                    player.rank === 1 
                      ? 'text-yellow-400 text-glow' 
                      : player.rank === 2 
                      ? 'text-slate-350' 
                      : player.rank === 3 
                      ? 'text-amber-600' 
                      : 'text-slate-500'
                  }`}>
                    #{player.rank}
                  </span>

                  <span className={`text-sm ${isMe ? 'text-indigo-400 font-black' : 'text-white font-semibold'}`}>
                    {player.displayName} {isMe && '(You)'}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  {/* Streak icon */}
                  {player.streak >= 2 && (
                    <div className="flex items-center gap-0.5 text-orange-500 text-xs font-black" title={`${player.streak} streak`}>
                      <Flame className="w-4 h-4 fill-orange-500" />
                      <span>{player.streak}</span>
                    </div>
                  )}

                  <span className="text-sm font-black text-slate-300">
                    {player.score} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2">
          Waiting for host to proceed...
        </p>
      </div>
    </div>
  );
}
