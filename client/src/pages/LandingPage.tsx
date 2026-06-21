import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import { 
  Play, Sparkles, Trophy, Users, Terminal, Code2, 
  HelpCircle, ChevronRight, Zap, ShieldAlert, BarChart3, 
  Check, X, ArrowRight, Hash, User
} from 'lucide-react';
import confetti from 'canvas-confetti';

export default function LandingPage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

  // -------------------------------------------------------------
  // Hero Mockup Simulator States
  // -------------------------------------------------------------
  const [simStep, setSimStep] = useState<'idle' | 'selected' | 'submitted' | 'revealed'>('idle');
  const [simOption, setSimOption] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [simTimer, setSimTimer] = useState(12);
  const [simRohanScore, setSimRohanScore] = useState(1500);

  // Timer effect for Hero Simulator
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (simStep !== 'revealed' && simStep !== 'submitted' && simTimer > 0) {
      interval = setInterval(() => {
        setSimTimer((prev) => prev - 1);
      }, 1000);
    } else if (simTimer === 0 && simStep === 'idle') {
      // Auto-submit option D on timeout as mock behavior
      setSimOption('D');
      setSimStep('submitted');
    }
    return () => clearInterval(interval);
  }, [simTimer, simStep]);

  const handleSimSelect = (option: 'A' | 'B' | 'C' | 'D') => {
    if (simStep === 'idle' || simStep === 'selected') {
      setSimOption(option);
      setSimStep('selected');
    }
  };

  const handleSimSubmit = () => {
    if (simStep === 'selected') {
      setSimStep('submitted');
    }
  };

  const handleSimReveal = () => {
    if (simStep === 'submitted') {
      setSimStep('revealed');
      if (simOption === 'C') {
        // Confetti burst for Rohan (correct option)
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { x: 0.8, y: 0.6 }
        });
        setSimRohanScore(2420);
      }
    }
  };

  const handleSimReset = () => {
    setSimStep('idle');
    setSimOption(null);
    setSimTimer(12);
    setSimRohanScore(1500);
  };

  // -------------------------------------------------------------
  // Section 4: Interactive Teaser Question States
  // -------------------------------------------------------------
  const [demoSelected, setDemoSelected] = useState<number | null>(null);
  const [demoRevealed, setDemoRevealed] = useState(false);

  const handleDemoSelect = (idx: number) => {
    if (!demoRevealed) {
      setDemoSelected(idx);
    }
  };

  const handleDemoReveal = () => {
    if (demoSelected !== null) {
      setDemoRevealed(true);
      if (demoSelected === 0) { // first option is correct
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.7 }
        });
      }
    }
  };

  const handleDemoReset = () => {
    setDemoSelected(null);
    setDemoRevealed(false);
  };

  // -------------------------------------------------------------
  // Section 6: Embedded Join Form States
  // -------------------------------------------------------------
  const [joinCode, setJoinCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setJoinError(null);

    const codeStr = joinCode.trim();
    const nameStr = displayName.trim();

    if (!codeStr || codeStr.length !== 6 || isNaN(Number(codeStr))) {
      setJoinError('Room Code must be a 6-digit number.');
      return;
    }
    if (!nameStr || nameStr.length < 2 || nameStr.length > 15) {
      setJoinError('Display name must be 2-15 characters.');
      return;
    }

    // Redirect to join page with query params
    navigate(`/join?code=${codeStr}&name=${encodeURIComponent(nameStr)}`);
  };

  return (
    <div className="min-h-screen text-white flex flex-col font-sans selection:bg-indigo-500 selection:text-white relative bg-slate-950 scroll-smooth">
      
      {/* Background Gradient Accents */}
      <div className="absolute top-0 left-0 w-full h-[800px] bg-gradient-to-b from-indigo-950/25 via-purple-950/15 to-transparent pointer-events-none -z-10" />
      <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none -z-10 animate-pulse duration-5000" />
      <div className="absolute bottom-[40%] left-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none -z-10 animate-pulse duration-7000" />
      <div className="absolute bottom-[5%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-500/5 blur-[120px] pointer-events-none -z-10" />

      {/* Navbar */}
      <header className="glass-panel sticky top-0 z-50 px-6 py-4 border-b border-slate-900/60 bg-slate-950/65 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <a href="#" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-all">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-black font-display tracking-tight bg-gradient-to-r from-white to-slate-200 bg-clip-text text-transparent">
              Classroom Quiz
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-8 text-sm font-bold text-slate-400">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#interactive-demo" className="hover:text-white transition-colors">Live Demo</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
          </nav>

          <div className="flex items-center gap-4">
            <Link 
              to="/join" 
              className="text-sm font-black text-indigo-400 hover:text-indigo-300 transition-all px-4 py-2 rounded-xl hover:bg-indigo-500/5 border border-transparent hover:border-indigo-500/20"
            >
              Join Game
            </Link>

            {isAuthenticated ? (
              <Link 
                to="/host/dashboard" 
                className="bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-extrabold py-2 px-5 rounded-xl shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5"
              >
                Go to Dashboard
              </Link>
            ) : (
              <Link 
                to="/login" 
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 text-white text-sm font-extrabold py-2 px-5 rounded-xl transition-all"
              >
                Teacher Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 md:pt-24 lg:pt-28 flex flex-col lg:flex-row items-center gap-16 z-10">
        
        {/* Left Column: Copy & Actions */}
        <div className="flex-1 space-y-8 text-left max-w-2xl lg:max-w-none">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 text-xs font-black text-indigo-300 tracking-wider uppercase">
            <Zap className="w-3.5 h-3.5" /> High-Engagement Classroom Tool
          </div>
          
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black font-display tracking-tight leading-[1.1] text-glow">
            Tired of Blank Stares? <br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              Turn Your Classroom Into a Live Game Show.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 font-medium leading-relaxed">
            Classroom Quiz is a premium, host-controlled live quiz platform where students compete in real-time from their phones. Engineered for CS and standard classes.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            {isAuthenticated ? (
              <Link 
                to="/host/dashboard" 
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 hover:shadow-indigo-500/35 text-base"
              >
                <Trophy className="w-5 h-5" /> Go to Dashboard
              </Link>
            ) : (
              <Link 
                to="/register" 
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-500/25 transition-all transform hover:-translate-y-0.5 hover:shadow-indigo-500/35 text-base"
              >
                Get Started
              </Link>
            )}

            <Link 
              to="/join" 
              className="inline-flex items-center justify-center gap-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 hover:text-white font-black py-4 px-8 rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 text-base"
            >
              <Play className="w-5 h-5 text-indigo-400 fill-indigo-400/20" /> Join a Game
            </Link>
          </div>

          {/* Value Props List */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-900/50">
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-400">
              <div className="w-5 h-5 rounded bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">✓</div>
              <span>No Student Accounts Needed</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-400">
              <div className="w-5 h-5 rounded bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Code2 className="w-3.5 h-3.5" />
              </div>
              <span>Code Snippet Support</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-400">
              <div className="w-5 h-5 rounded bg-amber-500/10 border border-emerald-500/20 flex items-center justify-center text-amber-400">✓</div>
              <span>Host-Controlled Reveal</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm font-bold text-slate-400">
              <div className="w-5 h-5 rounded bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Users className="w-3.5 h-3.5" />
              </div>
              <span>Full Analytics Export</span>
            </div>
          </div>
        </div>

        {/* Right Column: Stylized HIGH IMPACT Interactive Mockup Simulator */}
        <div className="flex-1 w-full lg:w-auto flex items-center justify-center select-none relative">
          
          {/* Floating decorative tags */}
          <div className="absolute top-[10%] left-[20%] w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-sm font-bold rotate-12 animate-bounce duration-3000">?</div>
          <div className="absolute bottom-[10%] right-[10%] w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-xs font-bold -rotate-12 animate-bounce duration-4000">✓</div>
          
          {/* Simulator Container */}
          <div className="relative w-full max-w-lg aspect-[1.4/1] flex gap-4 sm:gap-6 items-end p-2 border border-slate-800/40 rounded-3xl bg-slate-900/10 backdrop-blur shadow-glow">
            
            {/* Screen 1: Host Dashboard Mockup */}
            <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[90%] relative">
              {/* Header Bar */}
              <div className="px-3 py-2 bg-slate-950/60 border-b border-slate-800/80 flex items-center justify-between text-[9px] font-bold text-slate-400">
                <span className="flex items-center gap-1.5"><Terminal className="w-3 h-3 text-indigo-400" /> Host Dashboard</span>
                <span className="text-glow bg-indigo-500/10 border border-indigo-500/25 px-1.5 py-0.5 rounded text-[7px] uppercase tracking-wider">LIVE</span>
              </div>
              
              {/* Content Panel */}
              <div className="p-3.5 flex-1 flex flex-col justify-between text-left space-y-2.5">
                <div className="space-y-0.5">
                  <div className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest">Question 3 of 10</div>
                  <h3 className="text-[11px] font-bold text-white leading-tight">What does this code return?</h3>
                </div>

                {/* CSS Code Snippet Mock */}
                <div className="bg-slate-950 border border-slate-850 p-2 rounded font-mono text-[8px] leading-3.5 text-left text-slate-300">
                  <span className="text-purple-400">function</span> <span className="text-blue-400">greet</span>() &#123;<br />
                  &nbsp;&nbsp;<span className="text-purple-400">return</span> <span className="text-emerald-400">"Hello, World!"</span>;<br />
                  &#125;
                </div>

                {/* Simulated Response Counter / Actions */}
                <div className="bg-slate-950/80 border border-slate-800/60 rounded-xl p-2 space-y-1.5">
                  <div className="flex justify-between items-center text-[8px] font-bold text-slate-400">
                    <span>STATUS: {simStep === 'revealed' ? 'REVEALED' : 'ANSWERING'}</span>
                    <span className="text-indigo-400">
                      {simStep === 'idle' ? '1 / 2 locked' : simStep === 'selected' ? '1 / 2 locked' : '2 / 2 locked'}
                    </span>
                  </div>

                  {simStep === 'submitted' && (
                    <button
                      onClick={handleSimReveal}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[8px] font-black py-1 px-2 rounded tracking-wider uppercase animate-pulse transition-all"
                    >
                      Reveal Correct Answer
                    </button>
                  )}

                  {simStep === 'revealed' && (
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-[8px] font-bold text-emerald-400">
                        <span>Accuracy: {simOption === 'C' ? '100%' : '50%'}</span>
                        <button onClick={handleSimReset} className="text-indigo-400 underline uppercase tracking-wider text-[7px]">Reset</button>
                      </div>
                    </div>
                  )}

                  {/* Leaderboard Table inside Host Mockup */}
                  <div className="space-y-1 text-[8px] border-t border-slate-900 pt-1.5">
                    <div className="flex justify-between items-center px-1 py-0.5 rounded text-slate-200">
                      <span className="font-bold flex items-center gap-1">
                        <span className="text-amber-400">1.</span> Rohan
                      </span>
                      <span className="font-black text-indigo-300">{simRohanScore} pts</span>
                    </div>
                    <div className="flex justify-between items-center px-1 py-0.5 rounded text-slate-400">
                      <span className="font-bold flex items-center gap-1">
                        <span>2.</span> Priya
                      </span>
                      <span className="font-semibold text-slate-300">{simStep === 'revealed' && simOption !== 'C' ? 1800 : 1800} pts</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Screen 2: Student Phone Mockup */}
            <div className="w-[145px] sm:w-[155px] bg-slate-950 border-[6px] border-slate-900 rounded-[28px] overflow-hidden shadow-3xl h-full flex flex-col relative ring-1 ring-slate-800">
              
              {/* Speaker Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-14 h-3.5 bg-slate-900 rounded-b-xl z-20 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-slate-950 rounded-full" />
              </div>

              {/* Student Play Screen Content */}
              <div className="p-3 pt-6 flex-1 flex flex-col justify-between text-center relative z-0">
                
                {/* Header Info */}
                <div className="flex justify-between items-center border-b border-slate-900 pb-1">
                  <span className="text-[8px] font-bold text-slate-400">Rohan</span>
                  
                  {/* Timer Ring Mockup */}
                  <div className={`w-4 h-4 rounded-full border border-amber-500/80 flex items-center justify-center text-[7px] font-black text-amber-400 ${simStep !== 'revealed' && simStep !== 'submitted' ? 'animate-pulse' : ''}`}>
                    {simTimer}s
                  </div>
                </div>

                {/* Simulated Question Info & Code Snippet */}
                <div className="flex-1 flex flex-col justify-center my-2 text-left space-y-1 select-none animate-fade-in">
                  <div className="text-[6px] font-bold text-indigo-400 uppercase tracking-widest leading-none">Question 3 of 10</div>
                  <h4 className="text-[8px] font-extrabold text-white leading-tight">What does this code return?</h4>
                  <div className="bg-slate-900 border border-slate-850 p-1 rounded font-mono text-[5px] leading-2 text-slate-350 overflow-x-auto">
                    <span className="text-purple-400">function</span> <span className="text-blue-400">greet</span>() &#123;<br />
                    &nbsp;&nbsp;<span className="text-purple-400">return</span> <span className="text-emerald-400">"Hello, World!"</span>;<br />
                    &#125;
                  </div>
                </div>

                {/* Interactive Options Box */}
                <div className="space-y-1 pb-1">
                  {simStep === 'revealed' ? (
                    <div className="space-y-1.5 py-4">
                      {simOption === 'C' ? (
                        <div className="animate-scale-in">
                          <span className="text-emerald-400 font-black text-[10px] block">CORRECT!</span>
                          <span className="text-slate-400 text-[8px] block mt-0.5">Winner Winner!</span>
                          <span className="text-[12px] font-extrabold text-amber-400 block mt-1">+920 pts</span>
                        </div>
                      ) : (
                        <div className="animate-scale-in">
                          <span className="text-rose-500 font-black text-[10px] block">INCORRECT!</span>
                          <span className="text-slate-400 text-[8px] block mt-0.5">Correct was Option C</span>
                          <span className="text-[10px] font-extrabold text-slate-500 block mt-1">+0 pts</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="text-[6px] text-slate-500 font-bold uppercase tracking-widest text-left">Click to Select</div>
                      
                      <div className="grid grid-cols-2 gap-1 bg-slate-900/40 p-1 rounded-xl">
                        <div 
                          onClick={() => handleSimSelect('A')}
                          className={`p-1 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-1 ${
                            simOption === 'A' 
                              ? 'bg-rose-500/25 border-rose-500 scale-[1.02]' 
                              : 'bg-slate-950 border-slate-850 hover:border-indigo-500'
                          }`}
                        >
                          <div className="w-3 h-3 rounded bg-rose-500/20 text-rose-400 flex items-center justify-center text-[6px] font-black shrink-0">A</div>
                          <span className="text-[5px] font-mono text-slate-350 truncate">undefined</span>
                        </div>
                        <div 
                          onClick={() => handleSimSelect('B')}
                          className={`p-1 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-1 ${
                            simOption === 'B' 
                              ? 'bg-blue-500/25 border-blue-500 scale-[1.02]' 
                              : 'bg-slate-950 border-slate-850 hover:border-indigo-500'
                          }`}
                        >
                          <div className="w-3 h-3 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-[6px] font-black shrink-0">B</div>
                          <span className="text-[5px] font-mono text-slate-350 truncate">null</span>
                        </div>
                        <div 
                          onClick={() => handleSimSelect('C')}
                          className={`p-1 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-1 ${
                            simOption === 'C' 
                              ? 'bg-indigo-600/30 border-indigo-500 scale-[1.02]' 
                              : 'bg-slate-950 border-slate-850 hover:border-indigo-500'
                          }`}
                        >
                          <div className="w-3 h-3 rounded bg-indigo-500 text-white flex items-center justify-center text-[6px] font-black shrink-0">C</div>
                          <span className="text-[5px] font-mono text-white truncate">"Hello, World!"</span>
                        </div>
                        <div 
                          onClick={() => handleSimSelect('D')}
                          className={`p-1 rounded-lg border text-left cursor-pointer transition-all flex items-center gap-1 ${
                            simOption === 'D' 
                              ? 'bg-amber-500/25 border-amber-500 scale-[1.02]' 
                              : 'bg-slate-950 border-slate-850 hover:border-indigo-500'
                          }`}
                        >
                          <div className="w-3 h-3 rounded bg-amber-500/20 text-amber-400 flex items-center justify-center text-[6px] font-black shrink-0">D</div>
                          <span className="text-[5px] font-mono text-slate-350 truncate">TypeError</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Dynamic Submit Block */}
                {simStep === 'idle' && (
                  <div className="w-full bg-slate-900 border border-slate-800 text-slate-500 text-[7px] font-extrabold py-1.5 rounded-lg">
                    Select an option above
                  </div>
                )}
                {simStep === 'selected' && (
                  <button 
                    onClick={handleSimSubmit}
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[7px] font-black py-1.5 rounded-lg shadow hover:opacity-90 animate-bounce transition-all"
                  >
                    Lock Selection
                  </button>
                )}
                {simStep === 'submitted' && (
                  <div className="w-full bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-[7px] font-bold py-1.5 rounded-lg">
                    Waiting for Host...
                  </div>
                )}
                {simStep === 'revealed' && (
                  <button
                    onClick={handleSimReset}
                    className="w-full bg-slate-900 hover:bg-slate-850 border border-slate-850 text-slate-400 text-[7px] font-bold py-1.5 rounded-lg"
                  >
                    Play Simulator Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            SIMPLE WORKFLOW
          </span>
          <h2 className="text-3xl md:text-4xl font-black font-display tracking-tight">
            How It Works
          </h2>
          <p className="text-slate-400 font-medium">
            Set up and host interactive quiz sessions in minutes. Engage students instantly.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="glass-card p-8 rounded-2xl relative border-slate-800/60 text-left hover:border-indigo-500/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-400 font-black mb-6 group-hover:scale-105 transition-all">
              <Code2 className="w-6 h-6" />
            </div>
            <div className="absolute top-6 right-8 text-4xl font-black text-slate-800/40 select-none font-display">01</div>
            <h3 className="text-lg font-bold text-white mb-2">Create & Import</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              Upload your questions: type them manually, bulk paste text blocks, or upload a CSV file. Syntax-highlighted code snippet blocks are fully supported.
            </p>
          </div>

          {/* Step 2 */}
          <div className="glass-card p-8 rounded-2xl relative border-slate-800/60 text-left hover:border-indigo-500/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-center text-purple-400 font-black mb-6 group-hover:scale-105 transition-all">
              <Terminal className="w-6 h-6" />
            </div>
            <div className="absolute top-6 right-8 text-4xl font-black text-slate-800/40 select-none font-display">02</div>
            <h3 className="text-lg font-bold text-white mb-2">Launch Session</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              Start a live session. Students open any browser, input the 6-digit code, and join immediately. No student accounts or app installations required.
            </p>
          </div>

          {/* Step 3 */}
          <div className="glass-card p-8 rounded-2xl relative border-slate-800/60 text-left hover:border-indigo-500/20 transition-all group">
            <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/25 flex items-center justify-center text-pink-400 font-black mb-6 group-hover:scale-105 transition-all">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="absolute top-6 right-8 text-4xl font-black text-slate-800/40 select-none font-display">03</div>
            <h3 className="text-lg font-bold text-white mb-2">Engage & Compete</h3>
            <p className="text-slate-400 text-sm leading-relaxed font-medium">
              Advance through questions. You control the answer reveal to build suspense. Live leaderboards keep energy high and drive positive competition.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Highlights Section */}
      <section id="features" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">
            FEATURE OVERVIEW
          </span>
          <h2 className="text-3xl md:text-4xl font-black font-display tracking-tight">
            Built for Modern Classrooms
          </h2>
          <p className="text-slate-400 font-medium">
            Powerful mechanics designed to deliver premium classroom experiences and full analytics.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Card 1 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Trophy className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Live Leaderboard</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Real-time rankings and streaks keep student energy high, encouraging speed and accuracy.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 mb-4">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Syntax Highlighted Code</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Embed syntax-highlighted code snippets seamlessly in questions. Perfect for CS teachers.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Host-Controlled Pace</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Build suspense by deciding exactly when to lock answers and reveal results, rather than relying on auto-timers.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Celebration Displays</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Vibrant animations, star-landing effects, and clear winner screens keep engagement focused and fun.
            </p>
          </div>

          {/* Card 5 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 mb-4">
              <BarChart3 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Advanced Reports</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Get student standings, response matrices, and detailed question-by-question metrics in CSV or PDF formats.
            </p>
          </div>

          {/* Card 6 */}
          <div className="glass-panel p-6 rounded-2xl border-slate-850 hover:border-indigo-500/10 hover:bg-slate-900/20 transition-all text-left">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Zero Friction Joins</h3>
            <p className="text-slate-400 text-xs leading-relaxed font-medium">
              Students join with a room code and a display name. No registrations, emails, or student accounts necessary.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Demo / Live Preview Section */}
      <section id="interactive-demo" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left Column: Context */}
          <div className="text-left space-y-6">
            <span className="text-xs font-black uppercase tracking-widest text-pink-400 bg-pink-500/10 border border-pink-500/20 px-3 py-1 rounded-full">
              INTERACTIVE DEMO
            </span>
            <h2 className="text-3xl md:text-4xl font-black font-display tracking-tight text-glow">
              Test Student Experience
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed">
              Don't just take our word for it. Click options on the right side card to simulate how students lock in, receive correct/incorrect celebrations, and check scoreboards in real-time.
            </p>
            <div className="space-y-4 pt-4 border-t border-slate-900">
              <div className="flex gap-4">
                <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs">1</div>
                <p className="text-xs text-slate-350 font-medium">Click on your preferred answer option.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs">2</div>
                <p className="text-xs text-slate-350 font-medium">Click "Reveal Answer" to simulate teacher revealing results.</p>
              </div>
              <div className="flex gap-4">
                <div className="w-5 h-5 shrink-0 rounded-full bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 text-xs">3</div>
                <p className="text-xs text-slate-350 font-medium">Verify points awarded and confetti triggers!</p>
              </div>
            </div>
          </div>

          {/* Right Column: Teaser Component Widget */}
          <div className="w-full max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-glow relative">
            
            {/* Header info */}
            <div className="flex justify-between items-center border-b border-slate-800/80 pb-4 mb-6">
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-indigo-400 tracking-wider">Practice Preview Mode</span>
                <h3 className="text-sm font-black text-white">Teacher's Live Quiz Session</h3>
              </div>
              <span className="bg-indigo-500/10 text-indigo-400 text-[8px] font-black px-2 py-0.5 rounded border border-indigo-500/20 tracking-wider">ACTIVE</span>
            </div>

            {/* Question Text */}
            <div className="text-left space-y-4 mb-6">
              <div className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Question: CSS flex container</div>
              <h4 className="text-base font-bold text-white leading-tight">Which CSS declaration turns an element into a flex container?</h4>
            </div>

            {/* Option choices */}
            <div className="space-y-3 mb-6">
              {['display: flex', 'flex-direction: row', 'align-items: center', 'justify-content: center'].map((opt, idx) => {
                const isSelected = demoSelected === idx;
                const isCorrect = idx === 0;

                let borderStyle = 'border-slate-800 hover:border-indigo-500/50 bg-slate-950/40';
                if (isSelected) {
                  borderStyle = 'border-indigo-500 bg-indigo-500/10 scale-[1.01]';
                }
                if (demoRevealed) {
                  if (isCorrect) {
                    borderStyle = 'border-emerald-500 bg-emerald-500/15 text-emerald-400';
                  } else if (isSelected) {
                    borderStyle = 'border-rose-500 bg-rose-500/15 text-rose-400';
                  }
                }

                return (
                  <div 
                    key={idx}
                    onClick={() => handleDemoSelect(idx)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between font-mono text-xs ${borderStyle}`}
                  >
                    <span>{opt}</span>
                    {demoRevealed && isCorrect && <Check className="w-4 h-4 text-emerald-400" />}
                    {demoRevealed && isSelected && !isCorrect && <X className="w-4 h-4 text-rose-400" />}
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions for Teaser Widget */}
            <div className="flex gap-4">
              {demoSelected !== null && !demoRevealed && (
                <button
                  onClick={handleDemoReveal}
                  className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-650 hover:to-purple-700 text-white font-extrabold py-3 px-6 rounded-xl transition-all shadow-md text-xs uppercase tracking-wider"
                >
                  Reveal Correct Answer
                </button>
              )}
              {demoRevealed && (
                <button
                  onClick={handleDemoReset}
                  className="flex-1 bg-slate-900 border border-slate-800 text-slate-400 hover:text-white font-bold py-3 px-6 rounded-xl transition-all text-xs uppercase tracking-wider"
                >
                  Restart Simulation
                </button>
              )}
              {demoSelected === null && (
                <div className="flex-1 text-center py-3 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs font-semibold">
                  Select an option above to test
                </div>
              )}
            </div>

            {/* Simulation feedback */}
            {demoRevealed && (
              <div className="mt-4 p-3 bg-slate-950/60 border border-slate-850 rounded-xl text-left animate-fade-in">
                <span className="text-[8px] font-black uppercase text-indigo-400 tracking-wider">Scoring Breakdown</span>
                <p className="text-slate-450 text-xs mt-1 leading-relaxed font-medium">
                  {demoSelected === 0 
                    ? 'Correct! Rohan awarded +850 base points + 90 early submission speed bonus!' 
                    : 'Incorrect! Incorrect option selected. Deducted negative marking penalty (-25 points).'}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section id="comparison" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            MARKET COMPARISON
          </span>
          <h2 className="text-3xl md:text-4xl font-black font-display tracking-tight">
            Comparison Table
          </h2>
          <p className="text-slate-400 font-medium">
            Factual breakdown: How we compare with corporate quiz tools.
          </p>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-900 shadow-glow">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-900/60 border-b border-slate-800 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="p-5 md:p-6 font-black">Features</th>
                <th className="p-5 md:p-6 text-indigo-400 font-black">Classroom Quiz</th>
                <th className="p-5 md:p-6 font-bold">Kahoot</th>
                <th className="p-5 md:p-6 font-bold">Quizizz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-medium">
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">Code Snippets (Syntax-Highlighted)</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">Host-Controlled Reveal Mode</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">No Student Accounts Required</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">Unlimited Live Rooms</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-rose-500"><X className="w-4 h-4" /></td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">Comprehensive PDF/CSV Reports</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-slate-400">Paid Add-on</td>
                <td className="p-5 md:p-6 text-slate-400">Paid Add-on</td>
              </tr>
              <tr className="hover:bg-slate-900/20 transition-all">
                <td className="p-5 md:p-6 text-white font-bold">Flexible Timing Rules</td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
                <td className="p-5 md:p-6 text-emerald-400 font-bold"><Check className="w-4 h-4" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Final CTA + Embedded Join Box Section */}
      <section id="join" className="max-w-7xl mx-auto px-6 py-20 border-t border-slate-900">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column: CTA */}
          <div className="text-left space-y-6">
            <h2 className="text-3xl md:text-5xl font-black font-display tracking-tight text-glow">
              Ready to Make Your Class Compete?
            </h2>
            <p className="text-slate-400 font-medium leading-relaxed max-w-lg">
              Get started by hosting a live session as an instructor or coaching administrator. Create customizable questions, set Timing rules, and track student success metrics immediately.
            </p>
            <div className="pt-4">
              {isAuthenticated ? (
                <Link 
                  to="/host/dashboard" 
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 text-base"
                >
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <Link 
                  to="/register" 
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-650 hover:from-indigo-600 hover:to-purple-700 text-white font-black py-4 px-8 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 text-base"
                >
                  Create Instructor Account <ArrowRight className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* Right Column: Embedded Join Room Box */}
          <div className="w-full max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-glow text-center relative z-10">
            <h3 className="font-display text-2xl font-black mb-1.5 tracking-tight text-white select-none">
              Classroom <span className="text-indigo-400 text-glow">Quiz</span>
            </h3>
            <p className="text-slate-400 mb-6 text-xs font-semibold uppercase tracking-wider">Join active classroom game</p>
            
            {joinError && (
              <div className="bg-red-500/10 border border-red-550/20 text-red-200 p-4 rounded-xl mb-6 flex items-start gap-3 text-left animate-fade-in">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5 text-red-400" />
                <span className="text-xs font-semibold">{joinError}</span>
              </div>
            )}

            <form onSubmit={handleJoinSubmit} className="space-y-4">
              <div className="relative">
                <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-Digit Room Code" 
                  maxLength={6} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-center text-xl font-black tracking-widest uppercase text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:font-sans placeholder:tracking-normal placeholder:font-medium placeholder:text-slate-650"
                />
              </div>

              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input 
                  type="text" 
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Display Name" 
                  maxLength={15}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-center text-base font-bold text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:font-medium placeholder:text-slate-650"
                />
              </div>

              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-4 px-6 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 text-sm uppercase tracking-wider font-extrabold"
              >
                <Play className="w-4 h-4 fill-white" />
                Join Game Room
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer Section */}
      <footer className="glass-panel border-t border-slate-900/60 bg-slate-950/65 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-extrabold text-slate-400">Classroom Quiz</span>
          </div>

          <div className="flex flex-wrap gap-8 text-xs font-bold uppercase tracking-wider">
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#interactive-demo" className="hover:text-white transition-colors">Live Demo</a>
            <a href="#comparison" className="hover:text-white transition-colors">Comparison</a>
          </div>

          <div className="text-xs">
            Built with ❤️ for teachers. &copy; {new Date().getFullYear()} Classroom Quiz. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
