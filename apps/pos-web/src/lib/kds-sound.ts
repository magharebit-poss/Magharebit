let audioCtx: AudioContext | null = null;

export async function unlockAudio(): Promise<void> {
  try {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }
  } catch { /* ignore — browser may block before user gesture */ }
}

export function isAudioReady(): boolean {
  try {
    return audioCtx !== null && audioCtx.state === 'running';
  } catch {
    return false;
  }
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, volume: number): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.setValueAtTime(volume, startTime + duration - 0.02);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playChime(): void {
  try {
    if (!audioCtx || audioCtx.state !== 'running') return;
    const now = audioCtx.currentTime;
    playTone(audioCtx, 880,  now,        0.15, 0.25);
    playTone(audioCtx, 1175, now + 0.18, 0.15, 0.25);
  } catch { /* ignore */ }
}

/** Plays the chime now, then every intervalMs, until the returned stop function is called. */
export function startAlertLoop(intervalMs: number = 8000): () => void {
  playChime();
  const id = setInterval(() => { playChime(); }, intervalMs);
  return () => clearInterval(id);
}

export function stopAlertLoop(stop: (() => void) | null): void {
  if (stop) stop();
}
