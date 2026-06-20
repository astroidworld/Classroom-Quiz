let isMuted = false;

export const toggleMute = (): boolean => {
  isMuted = !isMuted;
  localStorage.setItem('quiz_audio_muted', isMuted ? 'true' : 'false');
  return isMuted;
};

export const getMuteState = (): boolean => {
  const saved = localStorage.getItem('quiz_audio_muted');
  if (saved !== null) {
    isMuted = saved === 'true';
  }
  return isMuted;
};

// Initialize mute state from cache
getMuteState();

/**
 * Synthesizes a pleasant ascending chord chime for correct answers.
 */
export const playCorrectSound = () => {
  if (isMuted) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(start);
      osc.stop(start + duration);
    };

    const now = ctx.currentTime;
    // Ascending C-major arpeggio
    playTone(523.25, now, 0.15); // C5
    playTone(659.25, now + 0.08, 0.15); // E5
    playTone(783.99, now + 0.16, 0.25); // G5
  } catch (err) {
    console.warn('Audio synthesis failed', err);
  }
};

/**
 * Synthesizes a decaying low buzz for incorrect answers.
 */
export const playIncorrectSound = () => {
  if (isMuted) return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (err) {
    console.warn('Audio synthesis failed', err);
  }
};
