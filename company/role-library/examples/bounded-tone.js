/** Original Web Audio example. Call ONLY from an explicit user click.
 * A low digital gain does not establish a safe acoustic SPL on a user's device.
 * The caller must render a visible Stop button wired to the returned stop().
 * This module contains no autostart, network access or medical claim.
 */
export async function startTone({ frequency = 440, durationSeconds = 1 } = {}) {
  if (!Number.isFinite(frequency) || frequency < 20 || frequency > 2000) throw new Error('Frequency must be 20–2000 Hz.');
  if (!Number.isFinite(durationSeconds) || durationSeconds < 0.1 || durationSeconds > 5) throw new Error('Duration must be 0.1–5 seconds.');
  const context = new AudioContext();
  let oscillator;
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { oscillator?.stop(); } catch { /* Already ended. */ }
    void context.close();
  };
  try {
    await context.resume();
    oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.03, now + 0.02);
    gain.gain.setValueAtTime(0.03, now + durationSeconds - 0.02);
    gain.gain.linearRampToValueAtTime(0, now + durationSeconds);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = stop;
    oscillator.start(now);
    oscillator.stop(now + durationSeconds);
    return { stop, frequency, durationSeconds, kind: 'synthetic-tone' };
  } catch (error) {
    stop();
    throw error;
  }
}
